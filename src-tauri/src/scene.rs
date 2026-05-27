use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::{Cursor, Read, Write},
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneLayout {
    pub x: f64,
    pub y: f64,
    pub size: f64,
    pub z: Option<i64>,
    pub anchor_x: Option<String>,
    pub anchor_y: Option<String>,
    pub offset_x: Option<String>,
    pub offset_y: Option<String>,
    pub orbit_x: Option<String>,
    pub orbit_y: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneItem {
    pub src: String,
    pub layout: SceneLayout,
    pub motion_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneModeData {
    pub mode: String,
    pub text: String,
    pub items: Vec<SceneItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneManifest {
    pub text: Option<String>,
    pub items: Vec<SceneItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneLibraryPayload {
    pub modes: Vec<SceneModeData>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneBundleExport {
    pub file_name: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SceneBundleMeta {
    pub mode_name: String,
}

fn get_scenes_root(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("get appDataDir failed: {e}"))?;
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("create appDataDir failed: {e}"))?;
    let scenes_root = app_data_dir.join("scenes");
    fs::create_dir_all(&scenes_root).map_err(|e| format!("create scenes root failed: {e}"))?;
    Ok(scenes_root)
}

fn validate_mode_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name == "battle"
    {
        return Err(format!("invalid mode name: {name}"));
    }
    Ok(())
}

fn ensure_safe_relative_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.is_absolute() {
        return Err("bundle contains absolute path".to_string());
    }
    for comp in p.components() {
        match comp {
            Component::Normal(_) => {}
            _ => return Err("bundle contains invalid path".to_string()),
        }
    }
    Ok(())
}

fn scan_scene_modes(scenes_root: &PathBuf) -> Result<Vec<SceneModeData>, String> {
    let mut modes_map: BTreeMap<String, SceneModeData> = BTreeMap::new();

    let entries = fs::read_dir(scenes_root).map_err(|e| format!("read scenes root failed: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let mode_name = entry.file_name().to_string_lossy().to_string();
        if mode_name.trim().is_empty() {
            continue;
        }

        let scene_path = path.join("scene.json");
        if !scene_path.exists() {
            continue;
        }

        let content = match fs::read_to_string(&scene_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut manifest: SceneManifest = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(_) => continue,
        };

        if manifest.items.is_empty() {
            continue;
        }

        let mut all_items_valid = true;
        for item in &mut manifest.items {
            let asset_path = path.join(&item.src);
            if !asset_path.exists() || !asset_path.is_file() {
                all_items_valid = false;
                break;
            }
            item.src = asset_path.to_string_lossy().to_string();
        }

        if !all_items_valid {
            continue;
        }

        modes_map.insert(
            mode_name.clone(),
            SceneModeData {
                mode: mode_name.clone(),
                text: manifest.text.unwrap_or(mode_name),
                items: manifest.items,
            },
        );
    }

    Ok(modes_map.into_values().collect())
}

pub fn sync_scene_library(app: &AppHandle) -> Result<SceneLibraryPayload, String> {
    let scenes_root = get_scenes_root(app)?;
    let modes = scan_scene_modes(&scenes_root)?;
    Ok(SceneLibraryPayload { modes })
}

pub fn get_scene_mode(app: &AppHandle, mode_name: String) -> Result<SceneManifest, String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let scene_path = scenes_root.join(&mode_name).join("scene.json");

    if !scene_path.exists() {
        return Ok(SceneManifest { text: None, items: vec![] });
    }

    let content =
        fs::read_to_string(&scene_path).map_err(|e| format!("read scene.json failed: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("parse scene.json failed: {e}"))
}

pub fn save_scene_mode(
    app: &AppHandle,
    mode_name: String,
    text: String,
    items: Vec<SceneItem>,
) -> Result<(), String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let mode_dir = scenes_root.join(&mode_name);

    if !mode_dir.starts_with(&scenes_root) {
        return Err("invalid mode name".to_string());
    }

    fs::create_dir_all(&mode_dir).map_err(|e| format!("create mode dir failed: {e}"))?;
    let manifest = SceneManifest { text: Some(text), items };
    let content =
        serde_json::to_string_pretty(&manifest).map_err(|e| format!("serialize failed: {e}"))?;
    fs::write(mode_dir.join("scene.json"), content)
        .map_err(|e| format!("write scene.json failed: {e}"))?;
    Ok(())
}

pub fn delete_scene_mode(app: &AppHandle, mode_name: String) -> Result<(), String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let mode_dir = scenes_root.join(&mode_name);

    if !mode_dir.starts_with(&scenes_root) {
        return Err("invalid mode name".to_string());
    }

    if mode_dir.exists() {
        fs::remove_dir_all(&mode_dir).map_err(|e| format!("delete mode dir failed: {e}"))?;
    }
    Ok(())
}

pub fn import_scene_asset(
    app: &AppHandle,
    mode_name: String,
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let mode_dir = scenes_root.join(&mode_name);

    if !mode_dir.starts_with(&scenes_root) {
        return Err("invalid mode name".to_string());
    }

    fs::create_dir_all(&mode_dir).map_err(|e| format!("create mode dir failed: {e}"))?;

    let safe_name = std::path::Path::new(&file_name)
        .file_name()
        .ok_or("invalid file name")?
        .to_string_lossy()
        .to_string();

    let dest_path = mode_dir.join(&safe_name);
    fs::write(&dest_path, data).map_err(|e| format!("write asset failed: {e}"))?;
    Ok(dest_path.to_string_lossy().to_string())
}

pub fn list_scene_assets(app: &AppHandle, mode_name: String) -> Result<Vec<String>, String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let mode_dir = scenes_root.join(&mode_name);

    if !mode_dir.exists() {
        return Ok(vec![]);
    }

    let mut assets: Vec<String> = fs::read_dir(&mode_dir)
        .map_err(|e| format!("read dir failed: {e}"))?
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            if !path.is_file() {
                return None;
            }
            let name = path.file_name()?.to_string_lossy().to_string();
            if name == "scene.json" {
                return None;
            }
            Some(path.to_string_lossy().to_string())
        })
        .collect();

    assets.sort();
    Ok(assets)
}

pub fn export_scene_bundle(app: &AppHandle, mode_name: String) -> Result<SceneBundleExport, String> {
    validate_mode_name(&mode_name)?;
    let scenes_root = get_scenes_root(app)?;
    let mode_dir = scenes_root.join(&mode_name);
    let scene_path = mode_dir.join("scene.json");

    if !scene_path.exists() {
        return Err(format!("scene not found: {mode_name}"));
    }

    let content =
        fs::read_to_string(&scene_path).map_err(|e| format!("read scene.json failed: {e}"))?;
    let manifest: SceneManifest =
        serde_json::from_str(&content).map_err(|e| format!("parse scene.json failed: {e}"))?;

    let mut cursor = Cursor::new(Vec::<u8>::new());
    {
        let mut zip = ZipWriter::new(&mut cursor);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

        let meta = SceneBundleMeta {
            mode_name: mode_name.clone(),
        };
        let meta_json =
            serde_json::to_vec_pretty(&meta).map_err(|e| format!("serialize bundle meta failed: {e}"))?;
        zip.start_file("bundle.json", options)
            .map_err(|e| format!("zip start bundle.json failed: {e}"))?;
        zip.write_all(&meta_json)
            .map_err(|e| format!("zip write bundle.json failed: {e}"))?;

        zip.start_file("scene.json", options)
            .map_err(|e| format!("zip start scene.json failed: {e}"))?;
        zip.write_all(content.as_bytes())
            .map_err(|e| format!("zip write scene.json failed: {e}"))?;

        for item in manifest.items {
            let file_name = Path::new(&item.src)
                .file_name()
                .ok_or_else(|| format!("invalid asset path in scene: {}", item.src))?
                .to_string_lossy()
                .to_string();
            let asset_path = mode_dir.join(&file_name);
            let asset_data = fs::read(&asset_path)
                .map_err(|e| format!("read asset failed ({file_name}): {e}"))?;

            zip.start_file(format!("assets/{file_name}"), options)
                .map_err(|e| format!("zip start asset failed ({file_name}): {e}"))?;
            zip.write_all(&asset_data)
                .map_err(|e| format!("zip write asset failed ({file_name}): {e}"))?;
        }

        zip.finish().map_err(|e| format!("zip finish failed: {e}"))?;
    }

    Ok(SceneBundleExport {
        file_name: format!("{mode_name}.chonkscene"),
        data: cursor.into_inner(),
    })
}

pub fn import_scene_bundle(app: &AppHandle, data: Vec<u8>) -> Result<String, String> {
    let scenes_root = get_scenes_root(app)?;
    let cursor = Cursor::new(data);
    let mut zip = ZipArchive::new(cursor).map_err(|e| format!("open bundle failed: {e}"))?;

    let mut meta_json = Vec::<u8>::new();
    zip.by_name("bundle.json")
        .map_err(|e| format!("bundle.json missing: {e}"))?
        .read_to_end(&mut meta_json)
        .map_err(|e| format!("read bundle.json failed: {e}"))?;

    let meta: SceneBundleMeta =
        serde_json::from_slice(&meta_json).map_err(|e| format!("parse bundle.json failed: {e}"))?;
    validate_mode_name(&meta.mode_name)?;

    let mode_dir = scenes_root.join(&meta.mode_name);
    if !mode_dir.starts_with(&scenes_root) {
        return Err("invalid mode name".to_string());
    }
    fs::create_dir_all(&mode_dir).map_err(|e| format!("create mode dir failed: {e}"))?;

    let mut scene_json = Vec::<u8>::new();
    zip.by_name("scene.json")
        .map_err(|e| format!("scene.json missing: {e}"))?
        .read_to_end(&mut scene_json)
        .map_err(|e| format!("read scene.json failed: {e}"))?;

    let manifest: SceneManifest =
        serde_json::from_slice(&scene_json).map_err(|e| format!("parse scene.json failed: {e}"))?;

    for item in &manifest.items {
        let asset_name = Path::new(&item.src)
            .file_name()
            .ok_or_else(|| format!("invalid asset in scene.json: {}", item.src))?
            .to_string_lossy()
            .to_string();
        ensure_safe_relative_path(&asset_name)?;

        let mut asset_data = Vec::<u8>::new();
        zip.by_name(&format!("assets/{asset_name}"))
            .map_err(|e| format!("missing asset in bundle ({asset_name}): {e}"))?
            .read_to_end(&mut asset_data)
            .map_err(|e| format!("read asset failed ({asset_name}): {e}"))?;

        fs::write(mode_dir.join(asset_name), asset_data)
            .map_err(|e| format!("write asset failed: {e}"))?;
    }

    fs::write(mode_dir.join("scene.json"), &scene_json)
        .map_err(|e| format!("write scene.json failed: {e}"))?;

    Ok(meta.mode_name)
}
