import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { syncSceneLibrary } from "../lib/scene-library";
import {
  deleteSceneMode,
  getSceneMode,
  importSceneAsset,
  listSceneAssets,
  saveSceneMode,
  type AssetInfo,
  type SaveableItem,
} from "../lib/scene-editor-api";
import type { SceneItem, SceneLayout } from "../lib/chonk";

// ─── draft types ──────────────────────────────────────────────────────────────

type ItemLayout = {
  x: number;
  y: number;
  size: number;
  z: number;
  anchorX: "left" | "center" | "right";
  anchorY: "top" | "center" | "bottom";
  orbitX: string;
  orbitY: string;
};

type ItemDraft = {
  id: string;
  src: string;
  layout: ItemLayout;
  motionKey: "rotate" | "slide" | "";
};

function defaultLayout(): ItemLayout {
  return { x: 50, y: 50, size: 20, z: 1, anchorX: "center", anchorY: "center", orbitX: "", orbitY: "" };
}

function defaultItem(id: string): ItemDraft {
  return { id, src: "", layout: defaultLayout(), motionKey: "" };
}

function itemToSaveable(item: ItemDraft): SaveableItem {
  const layout: SceneLayout = { x: item.layout.x, y: item.layout.y, size: item.layout.size };
  if (item.layout.z !== 1) layout.z = item.layout.z;
  if (item.layout.anchorX !== "center") layout.anchorX = item.layout.anchorX;
  if (item.layout.anchorY !== "center") layout.anchorY = item.layout.anchorY;
  if (item.layout.orbitX) layout.orbitX = item.layout.orbitX;
  if (item.layout.orbitY) layout.orbitY = item.layout.orbitY;
  return {
    src: item.src,
    layout,
    ...(item.motionKey ? { motionKey: item.motionKey } : {}),
  };
}

// Draft items → SceneItem[] for live preview (items without a src are skipped)
function draftToSceneItems(items: ItemDraft[], assets: AssetInfo[]): SceneItem[] {
  return items
    .filter((it) => it.src)
    .map((it) => {
      const url = assets.find((a) => a.name === it.src)?.url ?? it.src;
      return {
        src: url,
        layout: {
          x: it.layout.x,
          y: it.layout.y,
          size: it.layout.size,
          ...(it.layout.z !== 1 ? { z: it.layout.z } : {}),
          ...(it.layout.anchorX !== "center" ? { anchorX: it.layout.anchorX } : {}),
          ...(it.layout.anchorY !== "center" ? { anchorY: it.layout.anchorY } : {}),
          ...(it.layout.orbitX ? { orbitX: it.layout.orbitX } : {}),
          ...(it.layout.orbitY ? { orbitY: it.layout.orbitY } : {}),
        },
        ...(it.motionKey ? { motionKey: it.motionKey } : {}),
      } satisfies SceneItem;
    });
}

// ─── Scene List ───────────────────────────────────────────────────────────────

export function SceneListPage({
  onBack,
  onEdit,
  onNew,
}: {
  onBack: () => void;
  onEdit: (mode: string) => void;
  onNew: () => void;
}) {
  const [modes, setModes] = useState<string[]>([]);

  useEffect(() => {
    void syncSceneLibrary().then((p) =>
      setModes(p.modes.map((m) => m.mode).filter((m) => m !== "meme")),
    );
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-base font-semibold">Scenes</h2>
      </div>

      <div className="flex flex-col gap-1">
        {modes.length === 0 && (
          <p className="text-sm text-muted-foreground">No custom scenes yet.</p>
        )}
        {modes.map((mode) => (
          <div
            key={mode}
            className="flex items-center justify-between rounded-md border border-input px-3 py-2"
          >
            <span className="text-sm">{mode}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(mode)}>
              edit
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={onNew}>
        <Plus className="size-4" />
        new scene
      </Button>
    </div>
  );
}

// ─── Scene Editor ─────────────────────────────────────────────────────────────

export function SceneEditorPage({
  modeName: initialName,
  isNew,
  onMount,
  onBack,
  onSaved,
  onPreview,
}: {
  modeName: string;
  isNew: boolean;
  /** Called once on mount — lets ControlPanel pause the timer. */
  onMount?: () => void;
  onBack: () => void;
  onSaved: () => void;
  /** Called whenever draft items change so ControlPanel can emit a preview event. */
  onPreview?: (items: SceneItem[]) => void;
}) {
  const [name, setName] = useState(initialName);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importForItemRef = useRef<string | null>(null);
  const counter = useRef(0);
  const nextId = () => String(++counter.current);

  const manifestToItemsWithIds = (savedItems: SaveableItem[]): ItemDraft[] =>
    savedItems.map((item) => ({
      id: nextId(),
      src: item.src,
      layout: {
        x: item.layout.x,
        y: item.layout.y,
        size: item.layout.size,
        z: item.layout.z ?? 1,
        anchorX: (item.layout.anchorX ?? "center") as "left" | "center" | "right",
        anchorY: (item.layout.anchorY ?? "center") as "top" | "center" | "bottom",
        orbitX: item.layout.orbitX ?? "",
        orbitY: item.layout.orbitY ?? "",
      },
      motionKey: (item.motionKey ?? "") as "rotate" | "slide" | "",
    }));

  // Notify ControlPanel that the editor is open (pauses timer)
  useEffect(() => {
    onMount?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  // Emit live preview whenever items or assets change
  useEffect(() => {
    onPreview?.(draftToSceneItems(items, assets));
  }, [items, assets, onPreview]);

  const refreshAssets = async (modeName: string) => {
    const list = await listSceneAssets(modeName);
    setAssets(list);
    return list;
  };

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      const [manifest, assetList] = await Promise.all([
        getSceneMode(initialName),
        listSceneAssets(initialName),
      ]);
      setText(manifest.text ?? initialName);
      setAssets(assetList);
      setItems(manifestToItemsWithIds(manifest.items));
    })();
  }, [initialName, isNew]);

  const triggerImport = (forItemId: string | null) => {
    importForItemRef.current = forItemId;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const targetName = name.trim();
    if (!targetName) {
      setError("Enter a scene name first.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      const asset = await importSceneAsset(targetName, file.name, data);
      await refreshAssets(targetName);

      const forId = importForItemRef.current;
      if (forId !== null) {
        setItems((prev) =>
          prev.map((it) => (it.id === forId ? { ...it, src: asset.name } : it)),
        );
      } else {
        const id = nextId();
        setItems((prev) => [...prev, { ...defaultItem(id), src: asset.name }]);
      }
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, defaultItem(nextId())]);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const updateLayout = (id: string, patch: Partial<ItemLayout>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, layout: { ...it.layout, ...patch } } : it)),
    );

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Scene name is required."); return; }
    if (trimmedName === "meme" || trimmedName === "battle") {
      setError(`"${trimmedName}" is a reserved name.`);
      return;
    }
    if (items.length === 0) { setError("Add at least one item."); return; }
    if (items.some((it) => !it.src)) { setError("All items need an asset selected."); return; }

    setSaving(true);
    setError("");
    try {
      await saveSceneMode(trimmedName, text || trimmedName, items.map(itemToSaveable));
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete scene "${name}"?`)) return;
    try {
      await deleteSceneMode(name);
      onSaved();
    } catch (e) {
      setError(String(e));
    }
  };

  const assetUrl = (src: string) => assets.find((a) => a.name === src)?.url ?? "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-base font-semibold">
          {isNew ? "New Scene" : `Edit: ${initialName}`}
        </h2>
      </div>

      {isNew && (
        <div className="grid gap-1">
          <label className="text-sm font-medium">Scene name</label>
          <input
            className="h-9 rounded-md border border-input bg-background px-3 text-sm no-drag"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-cats"
          />
        </div>
      )}

      <div className="grid gap-1">
        <label className="text-sm font-medium">Display text</label>
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm no-drag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={name || "Scene text..."}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Items</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => triggerImport(null)}
            title="Import image and add as new item"
          >
            <Upload className="size-3" />
            import
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={assets.length === 0}
            title="Add item using existing asset"
          >
            <Plus className="size-3" />
            add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            assets={assets}
            assetUrl={assetUrl(item.src)}
            onUpdate={(patch) => updateItem(item.id, patch)}
            onUpdateLayout={(patch) => updateLayout(item.id, patch)}
            onImport={() => triggerImport(item.id)}
            onRemove={() => removeItem(item.id)}
          />
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="mt-2 flex flex-col gap-2">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "saving..." : "save scene"}
        </Button>
        {!isNew && (
          <Button type="button" variant="outline" onClick={handleDelete}>
            <Trash2 className="size-4" />
            delete scene
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif"
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  assets,
  assetUrl,
  onUpdate,
  onUpdateLayout,
  // onImport,
  onRemove,
}: {
  item: ItemDraft;
  assets: AssetInfo[];
  assetUrl: string;
  onUpdate: (patch: Partial<ItemDraft>) => void;
  onUpdateLayout: (patch: Partial<ItemLayout>) => void;
  onImport: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-input p-3 flex flex-col gap-2">
      {/* Asset row */}
      <div className="flex items-center gap-2">
        {assetUrl && (
          <img src={assetUrl} className="h-10 w-10 shrink-0 rounded object-contain" alt="" />
        )}
        <select
          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm no-drag"
          value={item.src}
          onChange={(e) => onUpdate({ src: e.target.value })}
        >
          <option value="">— select asset —</option>
          {assets.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="icon" onClick={onRemove}>
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* x / y */}
      <div className="grid grid-cols-2 gap-2">
        <SliderField label="x %" value={item.layout.x} min={0} max={100} step={1}
          onChange={(v) => onUpdateLayout({ x: v })} />
        <SliderField label="y %" value={item.layout.y} min={0} max={100} step={1}
          onChange={(v) => onUpdateLayout({ y: v })} />
      </div>

      {/* size / z */}
      <div className="grid grid-cols-2 gap-2">
        <SliderField label="size vw" value={item.layout.size} min={1} max={50} step={0.5}
          onChange={(v) => onUpdateLayout({ size: v })} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">z-index</label>
          <input
            type="number"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm no-drag"
            value={item.layout.z}
            onChange={(e) => onUpdateLayout({ z: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* anchors + motion */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">anchorX</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-1 text-xs no-drag"
            value={item.layout.anchorX}
            onChange={(e) => onUpdateLayout({ anchorX: e.target.value as "left" | "center" | "right" })}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">anchorY</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-1 text-xs no-drag"
            value={item.layout.anchorY}
            onChange={(e) => onUpdateLayout({ anchorY: e.target.value as "top" | "center" | "bottom" })}
          >
            <option value="top">top</option>
            <option value="center">center</option>
            <option value="bottom">bottom</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">motion</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-1 text-xs no-drag"
            value={item.motionKey}
            onChange={(e) => onUpdate({ motionKey: e.target.value as "rotate" | "slide" | "" })}
          >
            <option value="">none</option>
            <option value="rotate">rotate</option>
            <option value="slide">slide</option>
          </select>
        </div>
      </div>

      {/* orbit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">orbitX</label>
          <input
            className="h-8 rounded-md border border-input bg-background px-2 text-xs no-drag"
            value={item.layout.orbitX}
            placeholder="e.g. 20vw"
            onChange={(e) => onUpdateLayout({ orbitX: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">orbitY</label>
          <input
            className="h-8 rounded-md border border-input bg-background px-2 text-xs no-drag"
            value={item.layout.orbitY}
            placeholder="e.g. 10vh"
            onChange={(e) => onUpdateLayout({ orbitY: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Slider Field ─────────────────────────────────────────────────────────────

function SliderField({
  label, value, min, max, step, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <input
          type="number"
          className="h-6 w-14 rounded border border-input bg-background px-1 text-xs no-drag"
          value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <input
        type="range"
        className="w-full no-drag"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}