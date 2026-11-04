; reqochet installer additions (electron-builder includes this file; see electron-builder.yml nsis.include).
;
; 0.16 — the switch from ReqMan (owner, 31 Oct / 4 Nov 2026): reqochet is a new app with its own identity, so it would
; not replace ReqMan by itself. Before installing, remove an installed ReqMan (per-user install): close it, run its own
; uninstaller silently (it removes its files, shortcuts and Start-menu entry), then remove what is left of its folder.
; The user's settings in %APPDATA%\ReqMan are NOT touched here — the new app copies them on its first start and then
; removes that folder. Project folders (requirements/.reqman) are the user's data and are never touched.
!macro customInit
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\ReqMan\Uninstall ReqMan.exe"
    nsExec::Exec 'taskkill /IM ReqMan.exe /F'
    ExecWait '"$LOCALAPPDATA\Programs\ReqMan\Uninstall ReqMan.exe" /S _?=$LOCALAPPDATA\Programs\ReqMan'
    RMDir /r "$LOCALAPPDATA\Programs\ReqMan"
  ${EndIf}
!macroend
