@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py -3") else (set "PY=python")
%PY% --version
if errorlevel 1 goto missing
if not exist .venv\Scripts\python.exe %PY% -m venv .venv
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed
.venv\Scripts\python.exe app.py
goto end
:missing
echo 请先安装Python 3.10或更新版本，并勾选添加到PATH。
goto end
:failed
echo 安装失败，请检查网络和Python环境，保留上方错误信息。
:end
pause
