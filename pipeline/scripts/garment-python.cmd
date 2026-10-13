@echo off
rem Runs Python in the isolated garment environment (GarmentCode + NVIDIA Warp fork, research licence).
rem CPU kernels compile with Warp's bundled LLVM (warp-clang.dll); CUDA kernels use the env's NVRTC.
setlocal
set "PIPE=%~dp0.."
set "PATH=%PIPE%\envs\garment\Library\bin;%PIPE%\envs\garment;%PATH%"
set "PYTHONPATH=%PIPE%\third_party\GarmentCode;%PIPE%;%PYTHONPATH%"
"%PIPE%\envs\garment\python.exe" %*
