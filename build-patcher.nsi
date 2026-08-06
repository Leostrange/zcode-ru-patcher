; ZCode-Ru-Patcher v6.4.0
; Правильный формат: тихий NSIS self-extracting patcher, НЕ установщик.
; Не использовать InstallDir, MUI-страницы, запись в реестр или установку в AppData.

Unicode true
RequestExecutionLevel user
SetCompressor zlib

Name "ZCode Ru Patcher v6.4.0"
OutFile "ZCode-Ru-Patcher-v6.4.0.exe"
Icon "extracted\$PLUGINSDIR\app\icon.ico"
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\app"
  File /r "extracted\$PLUGINSDIR\app\*.*"
  ExecWait '"$PLUGINSDIR\app\ZCodeRuPatcher.exe"'
SectionEnd
