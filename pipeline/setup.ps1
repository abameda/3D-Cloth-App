# Thread asset factory: reproducible Windows setup (no admin rights needed).
# Creates isolated environments under pipeline/envs and pinned third-party checkouts under pipeline/third_party.
# Requirements: git, uv (https://docs.astral.sh/uv/), Visual Studio 2022 with "Desktop development with C++".
$ErrorActionPreference = 'Stop'
$pipe = $PSScriptRoot
Set-Location $pipe
New-Item -ItemType Directory -Force third_party, envs, tools, output | Out-Null

function Checkout($url, $dir, $commit) {
  if (-not (Test-Path "third_party\$dir")) { git -c core.longpaths=true clone -q $url "third_party\$dir" }
  git -C "third_party\$dir" -c core.longpaths=true fetch -q --depth 1 origin $commit
  git -C "third_party\$dir" -c core.longpaths=true checkout -q $commit
}
Checkout https://github.com/maria-korosteleva/GarmentCode.git GarmentCode d449629979028123a5c4dc9e732a2ec19b7fce31
Checkout https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode.git NvidiaWarp-GarmentCode 63baf6855efdd89b2834b74640f84b3bb0d86b50
Checkout https://github.com/naver/anny.git anny d6fc027ced5c17b6b0775dee944096ade7a9ef80

# --- Body environment (Anny, Apache-2.0 / CC0) ---
if (-not (Test-Path envs\body)) { uv venv -q --python 3.11 envs\body }
uv pip install -q --python envs\body\Scripts\python.exe torch --index-url https://download.pytorch.org/whl/cu128
uv pip install -q --python envs\body\Scripts\python.exe -e "third_party\anny[examples]" trimesh pygltflib scipy shapely `
  opencv-python-headless "rembg[cpu]" mediapipe pyrender
# CC0 MakeHuman system assets (eyes, brows, lashes, hair, shoes) and the MediaPipe face model (Apache-2.0).
if (-not (Test-Path tools\mh-assets\pack\hair)) {
  New-Item -ItemType Directory -Force tools\mh-assets | Out-Null
  Invoke-WebRequest https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip -OutFile tools\mh-assets\pack.zip
  Expand-Archive tools\mh-assets\pack.zip tools\mh-assets\pack -Force
}
if (-not (Test-Path tools\models\face_landmarker.task)) {
  New-Item -ItemType Directory -Force tools\models | Out-Null
  Invoke-WebRequest https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task -OutFile tools\models\face_landmarker.task
}

# --- Garment environment (GarmentCode MIT + Warp fork, NVIDIA research licence) ---
if (-not (Test-Path tools\Library\bin\micromamba.exe)) {
  Invoke-WebRequest https://micro.mamba.pm/api/micromamba/win-64/latest -OutFile tools\micromamba.tar.bz2
  tar -xjf tools\micromamba.tar.bz2 -C tools
}
$env:MAMBA_ROOT_PREFIX = "$pipe\tools\mamba"
if (-not (Test-Path envs\garment)) {
  tools\Library\bin\micromamba.exe create -y -q -p envs\garment -c nvidia/label/cuda-12.8.1 -c conda-forge `
    python=3.10 cuda-nvcc cuda-cudart-dev cuda-cudart-static cuda-nvrtc-dev libnvptxcompiler-dev cuda-version=12.8 "numpy<2"
}
git -C third_party\NvidiaWarp-GarmentCode apply --whitespace=nowarn "$pipe\patches\nvidiawarp-garmentcode-windows.patch" 2>$null
$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -property installationPath
cmd /c "call `"$vs\VC\Auxiliary\Build\vcvars64.bat`" >nul && cd /d third_party\NvidiaWarp-GarmentCode && ..\..\envs\garment\python.exe build_lib.py --cuda_path=`"$pipe\envs\garment\Library`" --quick --no_standalone"
# CPU fallback compiler: Warp's LLVM DLL is taken from the official warp-lang 1.0.0 wheel (Apache-2.0).
if (-not (Test-Path third_party\NvidiaWarp-GarmentCode\warp\bin\warp-clang.dll)) {
  $wheel = "$pipe\tools\warp-wheel"
  uv run --no-project --python 3.10 -- python -m pip download -q --no-deps --only-binary=:all: --platform win_amd64 --python-version 3.10 warp-lang==1.0.0 -d $wheel
  tar -xf (Get-ChildItem $wheel\*.whl).FullName -C $wheel warp/bin/warp-clang.dll
  Copy-Item $wheel\warp\bin\warp-clang.dll third_party\NvidiaWarp-GarmentCode\warp\bin\
}
uv pip install -q --python envs\garment\python.exe -e third_party\NvidiaWarp-GarmentCode -e third_party\GarmentCode
$out = ($pipe -replace '\\','/') + '/output/garmentcode'
@{ output=$out; datasets_path=''; datasets_sim=''; sim_configs_path='./assets/Sim_props'; bodies_default_path='./assets/bodies'; body_samples_path='' } |
  ConvertTo-Json | Set-Content -Encoding utf8 third_party\GarmentCode\system.json
Write-Host 'Thread asset factory ready.'
