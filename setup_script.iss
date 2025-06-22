; Script para Inno Setup v4 - Versión Simplificada y Definitiva

[Setup]
AppName=Sistema de Monitoreo SENAPRED
AppVersion=1.0
AppPublisher=SENAPRED Valparaíso
DefaultDirName={autopf}\SistemaMonitoreoSENAPRED
DefaultGroupName=Sistema Monitoreo SENAPRED
DisableProgramGroupPage=yes
OutputBaseFilename=Setup-Monitoreo-SENAPRED-v1.0
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
; Dejamos únicamente la tarea opcional para el ícono del escritorio.
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\SistemaMonitoreo\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\descargar_informe\descargar_informe.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Sistema de Monitoreo"; Filename: "{app}\SistemaMonitoreo.exe"
Name: "{group}\{cm:UninstallProgram,Sistema de Monitoreo}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Sistema de Monitoreo"; Filename: "{app}\SistemaMonitoreo.exe"; Tasks: desktopicon

[Run]
; --- CAMBIO IMPORTANTE ---
; Se eliminó el parámetro "Tasks: scheduletasks" porque las tareas ahora se crearán siempre.
Filename: "schtasks"; Parameters: "/Create /SC DAILY /TN ""Monitoreo SENAPRED AM"" /TR ""'{app}\descargar_informe.exe'"" /ST 11:00 /F"; Flags: runhidden
Filename: "schtasks"; Parameters: "/Create /SC DAILY /TN ""Monitoreo SENAPRED PM"" /TR ""'{app}\descargar_informe.exe'"" /ST 20:00 /F"; Flags: runhidden

; Ejecutar el servidor al finalizar la instalación
Filename: "{app}\SistemaMonitoreo.exe"; Description: "{cm:LaunchProgram,Sistema de Monitoreo}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\datos_extraidos\*"

[Code]
var
  PasswordPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  // Crear la página para pedir la contraseña
  PasswordPage := CreateInputQueryPage(wpWelcome,
    'Configuración de Correo Electrónico', 'Contraseña de Aplicación de Gmail',
    'Por favor, ingrese la contraseña de aplicación de 16 dígitos generada para Gmail.'#13#10'Esta se guardará de forma segura como una variable de entorno del sistema.');
  PasswordPage.Add('Contraseña:', True);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  PasswordValue: String;
begin
  // Validar que el campo de contraseña no esté vacío
  PasswordValue := Trim(PasswordPage.Values[0]);
  if Length(PasswordValue) <> 16 then
  begin
    MsgBox('La contraseña ingresada no parece ser una contraseña de aplicación de Gmail válida. Debe tener 16 caracteres.', mbError, MB_OK);
    Result := 'La contraseña no es válida.';
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  PasswordValue: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // Guardar la contraseña como variable de entorno del sistema
    PasswordValue := Trim(PasswordPage.Values[0]);
    if PasswordValue <> '' then
    begin
      // Usamos setx para crear la variable de entorno de forma permanente para todo el sistema (/M)
      Exec('setx', 'GMAIL_APP_PASSWORD "' + PasswordValue + '" /M', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;