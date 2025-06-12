// A simple authentication service that uses local storage
// This is meant for development purposes only - not for production

export interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
}

export class BasicAuthService {
  private static readonly USERS_STORAGE_KEY = 'app_users';
  private static readonly CURRENT_USER_KEY = 'app_current_user';
  
  // Simple password hashing function (NOT secure for production)
  private static hashPassword(password: string): string {
    // This is a very basic hash - not secure for production
    return btoa(password + '_salt');
  }

  // Initialize with default admin if no users exist
  public static init(): void {
    const users = this.getUsers();
    if (users.length === 0) {
      this.createUser({
        username: 'admin',
        password: 'admin',
        name: 'Administrator',
        isAdmin: true,
      });
      console.log('Created default admin user: username: "admin", password: "admin"');
    }
  }

  // Get all users (without password hashes)
  public static getUsers(): User[] {
    const usersJson = localStorage.getItem(this.USERS_STORAGE_KEY) || '[]';
    const users: StoredUser[] = JSON.parse(usersJson);
    
    // Return users without password hashes
    return users.map(({ passwordHash, ...user }) => user);
  }

  // Create a new user
  public static createUser(userData: { 
    username: string, 
    password: string, 
    name: string, 
    isAdmin?: boolean 
  }): User {
    const { username, password, name, isAdmin = false } = userData;
    
    // Check if username already exists
    const users = this.getStoredUsers();
    if (users.find(u => u.username === username)) {
      throw new Error('Username already exists');
    }
    
    const newUser: StoredUser = {
      id: Date.now().toString(),
      username,
      passwordHash: this.hashPassword(password),
      name,
      isAdmin,
      createdAt: new Date().toISOString(),
    };
    
    // Add user to storage
    users.push(newUser);
    localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(users));
    
    // Return user without password hash
    const { passwordHash, ...user } = newUser;
    return user;
  }

  // Login user
  public static login(username: string, password: string): User {
    const users = this.getStoredUsers();
    const user = users.find(u => 
      u.username === username && 
      u.passwordHash === this.hashPassword(password)
    );
    
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    // Store current user in session
    const { passwordHash, ...userWithoutPassword } = user;
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
    
    return userWithoutPassword;
  }

  // Logout current user
  public static logout(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  // Get current logged-in user
  public static getCurrentUser(): User | null {
    const userJson = localStorage.getItem(this.CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  // Check if a user is logged in
  public static isLoggedIn(): boolean {
    return !!this.getCurrentUser();
  }

  // Check if current user is admin
  public static isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user ? user.isAdmin : false;
  }
  
  // Get user by ID
  public static getUserById(id: string): User | null {
    const users = this.getUsers();
    const user = users.find(u => u.id === id);
    return user || null;
  }

  // Private: Get users with password hashes
  private static getStoredUsers(): StoredUser[] {
    const usersJson = localStorage.getItem(this.USERS_STORAGE_KEY) || '[]';
    return JSON.parse(usersJson);
  }
} 