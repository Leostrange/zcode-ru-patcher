; ============================================================
; ZCode Русский Патчер v6 — NSIS Installer
; ============================================================

Unicode true
SetCompressor /solid lzma
SetCompressorDictSize 64

!include "MUI2.nsh"

!define PRODUCT_NAME "ZCode Русский Патчер"
!define PRODUCT_VERSION "6.2"
!define INNER_EXE "ZCodeRuPatcher.exe"
!ifndef PATCHER_DIR
  !define PATCHER_DIR "."
!endif

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "ZCode-Ru-Patcher-v6.2-new.exe"
Icon "${PATCHER_DIR}\icon.ico"
RequestExecutionLevel user
ShowInstDetails hide
AutoCloseWindow true
SilentInstall silent
WindowIcon off

VIProductVersion "6.2.0.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "FileDescription" "Русификатор ZCode"
VIAddVersionKey "FileVersion" "6.2.0.0"

Section "Main"
  SetOutPath "$PLUGINSDIR\app"

  File "${PATCHER_DIR}\ZCodeRuPatcher.exe"
  File "${PATCHER_DIR}\d3dcompiler_47.dll"
  File "${PATCHER_DIR}\ffmpeg.dll"
  File "${PATCHER_DIR}\icudtl.dat"
  File "${PATCHER_DIR}\libEGL.dll"
  File "${PATCHER_DIR}\libGLESv2.dll"
  File "${PATCHER_DIR}\vk_swiftshader.dll"
  File "${PATCHER_DIR}\vk_swiftshader_icd.json"
  File "${PATCHER_DIR}\vulkan-1.dll"
  File "${PATCHER_DIR}\snapshot_blob.bin"
  File "${PATCHER_DIR}\v8_context_snapshot.bin"
  File "${PATCHER_DIR}\chrome_100_percent.pak"
  File "${PATCHER_DIR}\chrome_200_percent.pak"
  File "${PATCHER_DIR}\resources.pak"
  File "${PATCHER_DIR}\LICENSE.electron.txt"
  File "${PATCHER_DIR}\LICENSES.chromium.html"
  File "${PATCHER_DIR}\icon.ico"
  File "${PATCHER_DIR}\patch-core.js"
  File "${PATCHER_DIR}\patch-worker.js"
  File "${PATCHER_DIR}\ru-RU.json"
  File "${PATCHER_DIR}\tokyo_drift.mp3"

  SetOutPath "$PLUGINSDIR\app\locales"
  File /nonfatal "${PATCHER_DIR}\locales\*.pak"

  SetOutPath "$PLUGINSDIR\app\resources"
  File "${PATCHER_DIR}\resources\app.asar"
  File "${PATCHER_DIR}\resources\elevate.exe"

  SetOutPath "$PLUGINSDIR\app\resources\app.asar.unpacked"
  File /nonfatal "${PATCHER_DIR}\resources\app.asar.unpacked\*.*"

  SetOutPath "$PLUGINSDIR\app"
  ExecWait '"$PLUGINSDIR\app\${INNER_EXE}"'

  RMDir /r "$PLUGINSDIR\app"
SectionEnd

Function .onInit
  InitPluginsDir
FunctionEnd
