; reqochet installer additions (electron-builder includes this file; see electron-builder.yml nsis.include).
;
; 0.16 — the switch from ReqMan (owner, 31 Oct / 4 Nov 2026): reqochet is a new app with its own identity, so it would
; not replace ReqMan by itself. Before installing, remove an installed ReqMan (per-user install) with its own
; uninstaller (it removes its files, shortcuts and Start-menu entry).
; - Silent install (the automatic update from ReqMan): ReqMan has already closed itself to install the update; a
;   left-over process is ended.
; - Installer started by hand: if ReqMan is open, the user is asked to save and close it first — it is never killed
;   with unsaved edits (code review CR-02).
; - The folder is removed only when the uninstaller succeeded, so Windows' app list never keeps a broken entry (CR-08).
; The user's settings in %APPDATA%\ReqMan are NOT touched here — the new app copies them on its first start and then
; removes that folder. Project folders (requirements/.reqman) are the user's data and are never touched.
!macro customInit
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\reqman\Uninstall ReqMan.exe"
    ${IfNot} ${Silent}
      nsExec::ExecToStack 'cmd /c tasklist /FI "IMAGENAME eq ReqMan.exe" /NH | find /I "ReqMan.exe"'
      Pop $0
      Pop $1
      ${If} $0 == 0
        MessageBox MB_OKCANCEL|MB_ICONINFORMATION "ReqMan is open. reqochet replaces it.$\r$\n$\r$\nSave your work and close ReqMan, then click OK." IDOK reqmanClosed
        Abort
        reqmanClosed:
      ${EndIf}
    ${EndIf}
    nsExec::Exec 'taskkill /IM ReqMan.exe /F'
    ExecWait '"$LOCALAPPDATA\Programs\reqman\Uninstall ReqMan.exe" /S _?=$LOCALAPPDATA\Programs\reqman' $0
    ${If} $0 == 0
      RMDir /r "$LOCALAPPDATA\Programs\reqman"
    ${EndIf}
  ${EndIf}
!macroend
