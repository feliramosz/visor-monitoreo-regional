import sqlite3
import sys
from werkzeug.security import generate_password_hash

DATABASE_FILE = 'database.db'

def init_db():
    """Inicializa la base de datos y crea las tablas si no existen."""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()

        # Crear tabla de usuarios
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL CHECK (is_admin IN (0, 1)) DEFAULT 1
        );
        ''')

        # Crear tabla de registro de actividad (timeline)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            username TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT
        );
        ''')

        conn.commit()
        conn.close()
        print("Base de datos inicializada correctamente.")

    except sqlite3.Error as e:
        print(f"Error al inicializar la base de datos: {e}")

def add_user(username, password):
    """Añade un nuevo usuario a la base de datos."""
    if not username or not password:
        print("Error: El nombre de usuario y la contraseña no pueden estar vacíos.")
        return

    password_hash = generate_password_hash(password)

    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
        conn.commit()
        conn.close()
        print(f"Usuario '{username}' añadido correctamente.")
    except sqlite3.IntegrityError:
        print(f"Error: El usuario '{username}' ya existe.")
    except sqlite3.Error as e:
        print(f"Error al añadir usuario: {e}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python manage_database.py [init|adduser]")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'init':
        init_db()
    elif command == 'adduser':
        if len(sys.argv) != 4:
            print("Uso: python manage_database.py adduser <username> <password>")
            sys.exit(1)
        add_user(sys.argv[2], sys.argv[3])
    else:
        print(f"Comando desconocido: {command}")
