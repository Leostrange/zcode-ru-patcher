Unicode true
SetCompressor zlib

!define PRODUCT_NAME "ZCode Русский Патчер"
!define PRODUCT_VERSION "6.3"
!define INNER_EXE "ZCodeRuPatcher.exe"
!ifndef PATCHER_DIR
  !define PATCHER_DIR "."
!endif

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "ZCode-Ru-Patcher-v6.3.exe"
Icon "${PATCHER_DIR}\icon.ico"
RequestExecutionLevel user
SilentInstall silent
ShowInstDetails nevershow
AutoCloseWindow true
WindowIcon off

VIProductVersion "6.3.0.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "FileDescription" "Русификатор ZCode"
VIAddVersionKey "FileVersion" "6.3.0.0"
VIAddVersionKey "OriginalFilename" "ZCode-Ru-Patcher-v6.3.exe"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Leostrange"

Section "Main"
  SetOutPath "$PLUGINSDIR\app"
  File /r "${PATCHER_DIR}\*.*"
  ExecWait '"$PLUGINSDIR\app\${INNER_EXE}"'
  RMDir /r "$PLUGINSDIR\app"
SectionEnd

Function .onInit
  InitPluginsDir
FunctionEnd
