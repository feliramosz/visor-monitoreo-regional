import sqlite3
import sys
from werkzeug.security import generate_password_hash

DATABASE_FILE = 'database.db'

def init_db():
    """Inicializa la base de datos y crea las tablas si no existen."""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()

        # Crear tabla de usuarios con la columna 'role'
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'operador'
        );
        ''')

        # Crear tabla de registro de actividad
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            username TEXT NOT NULL,
            ip_address TEXT,
            action TEXT NOT NULL,
            details TEXT
        );
        ''')

        conn.commit()
        conn.close()
        print(f"Base de datos '{DATABASE_FILE}' inicializada correctamente.")

    except sqlite3.Error as e:
        print(f"Error al inicializar la base de datos: {e}")

def add_user(username, password, role='operador'):
    """Añade un nuevo usuario a la base de datos con un rol específico."""
    if not username or not password:
        print("Error: El nombre de usuario y la contraseña no pueden estar vacíos.")
        return

    password_hash = generate_password_hash(password)

    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, password_hash, role))
        conn.commit()
        conn.close()
        print(f"Usuario '{username}' añadido correctamente con el rol '{role}'.")
    except sqlite3.IntegrityError:
        print(f"Error: El usuario '{username}' ya existe.")
    except sqlite3.Error as e:
        print(f"Error al añadir usuario: {e}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python manage_database.py <comando> [argumentos...]")
        print("Comandos disponibles: init, adduser")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'init':
        init_db()
    elif command == 'adduser':
        if len(sys.argv) < 4:
            print("Uso: python manage_database.py adduser <username> <password> [--role <rol>]")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        role = 'operador' # Rol por defecto

        if '--role' in sys.argv:
            try:
                role_index = sys.argv.index('--role') + 1
                if role_index < len(sys.argv):
                    role = sys.argv[role_index]
            except ValueError:
                pass # No se encontró el flag
        
        add_user(username, password, role)
    else:
        print(f"Comando desconocido: {command}")
