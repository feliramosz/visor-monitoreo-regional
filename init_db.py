import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_NAME = 'database-staging.db'
SERVER_ROOT = os.path.dirname(os.path.abspath(__file__))
DATABASE_FILE = os.path.join(SERVER_ROOT, DB_NAME)

conn = sqlite3.connect(DATABASE_FILE)
cursor = conn.cursor()

# Crear tabla de usuarios
cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
)
''')
print("Tabla 'users' asegurada.")

# Crear tabla de logs
cursor.execute('''
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    username TEXT,
    ip_address TEXT,
    action TEXT,
    details TEXT
)
''')
print("Tabla 'activity_log' asegurada.")

# Crear el primer usuario administrador
print("\n--- Creación del Usuario Administrador ---")
admin_user = input("Ingresa el nombre de usuario para el administrador: ")
admin_pass = input(f"Ingresa la contraseña para '{admin_user}': ")

password_hash = generate_password_hash(admin_pass)

try:
    cursor.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        (admin_user, password_hash, 'administrador')
    )
    conn.commit()
    print(f"\n¡Éxito! Usuario '{admin_user}' creado como administrador.")
except sqlite3.IntegrityError:
    print(f"\nEl usuario '{admin_user}' ya existe. No se realizaron cambios.")
finally:
    conn.close()
