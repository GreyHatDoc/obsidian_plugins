/**
 * Symbol Parser Examples
 *
 * PURPOSE:
 * Comprehensive examples demonstrating symbol parser capabilities across all supported languages.
 *
 * COVERAGE:
 * - TypeScript: Classes, functions, interfaces, types, enums
 * - Python: Classes, functions, decorators, type hints
 * - C++: Classes, functions, templates, visibility
 * - Scala: Classes, objects, traits, case classes
 * - Rust: Structs, functions, traits, impl blocks
 *
 * USAGE:
 * These examples can be used to:
 * 1. Validate parser functionality
 * 2. Understand what symbols are detected
 * 3. Learn parser capabilities
 * 4. Generate test cases
 */

import { SymbolParserRegistry, ParseResult } from './symbolParserRegistry';

/**
 * Example 1: TypeScript Class and Functions
 */
export const typescriptExample = `
import { Logger } from './logger';

/**
 * User management service
 */
export class UserService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: string): Promise<User | null> {
    this.logger.info(\`Fetching user: \${id}\`);
    return await this.fetchFromDb(id);
  }

  private async fetchFromDb(id: string): Promise<User | null> {
    // Database query
    return null;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
}

type UserMap = Map<string, User>;

enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

export function createUser(name: string): User {
  return { id: '1', name, email: '' };
}
`;

/**
 * Example 2: Python Class and Functions
 */
export const pythonExample = `
from typing import Optional, List
from abc import ABC, abstractmethod

@dataclass
class User:
    id: str
    name: str
    email: str

class UserRepository(ABC):
    @abstractmethod
    def get_user(self, user_id: str) -> Optional[User]:
        pass

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    @property
    def user_count(self) -> int:
        return len(self.users)

    def get_user(self, user_id: str) -> Optional[User]:
        return self.repo.get_user(user_id)

    @staticmethod
    def validate_email(email: str) -> bool:
        return '@' in email

    @classmethod
    def from_dict(cls, data: dict) -> 'User':
        return cls(data['id'], data['name'], data['email'])

def create_user(name: str, email: str) -> User:
    return User(id='1', name=name, email=email)

async def fetch_user_async(user_id: str) -> Optional[User]:
    return None
`;

/**
 * Example 3: C++ Classes and Templates
 */
export const cppExample = `
#include <string>
#include <vector>

namespace UserManagement {

template <typename T>
class Repository {
public:
    virtual ~Repository() = default;

    template <typename U>
    std::vector<U> findAll() const;

protected:
    virtual T* find(const std::string& id) const = 0;

private:
    std::vector<T> cache_;
};

class User {
public:
    User(const std::string& name);
    ~User();

    const std::string& getName() const;
    void setName(const std::string& name);

    virtual std::string toString() const;

private:
    std::string name_;
    int id_;
};

class AdminUser : public User {
public:
    AdminUser(const std::string& name);

    void promote() override;
    std::string toString() const override;

private:
    static constexpr int ADMIN_LEVEL = 5;
};

enum class UserRole {
    Guest,
    User,
    Admin
};

}  // namespace UserManagement
`;

/**
 * Example 4: Scala Classes and Traits
 */
export const scalaExample = `
package com.example.users

import scala.concurrent.Future

sealed trait UserType
case object Admin extends UserType
case object User extends UserType
case object Guest extends UserType

@deprecated("Use UserServiceV2 instead")
case class User(
    id: String,
    name: String,
    email: String
) {
    def displayName: String = s"\$name <\$email>"
}

trait UserRepository {
    def findById(id: String): Future[Option[User]]
    def save(user: User): Future[Unit]
}

object UserService {
    implicit def defaultUserType: UserType = Guest
}

class UserService[T <: UserType: Manifest](
    repo: UserRepository
) {
    def getUser(id: String): Future[Option[User]] = {
        repo.findById(id)
    }

    private implicit val executor = scala.concurrent.ExecutionContext.global

    lazy val cachedUsers: Map[String, User] = Map.empty
}

type UserMap = Map[String, User]
type UserValidator = User => Boolean
`;

/**
 * Example 5: Rust Structs and Implementations
 */
export const rustExample = `
use std::collections::HashMap;

/// User representation
#[derive(Debug, Clone)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
}

/// Role enumeration
#[derive(Debug, PartialEq)]
pub enum Role {
    Admin,
    User,
    Guest,
}

/// User repository trait
pub trait UserRepository {
    fn find_by_id(&self, id: &str) -> Option<User>;
    fn save(&mut self, user: User) -> Result<(), String>;
}

pub struct UserService<T: UserRepository> {
    repo: T,
    cache: HashMap<String, User>,
}

impl<T: UserRepository> UserService<T> {
    pub fn new(repo: T) -> Self {
        Self {
            repo,
            cache: HashMap::new(),
        }
    }

    pub async fn get_user(&self, id: &str) -> Option<User> {
        self.repo.find_by_id(id)
    }

    pub fn create_user(name: &str, email: &str) -> User {
        User {
            id: String::from("1"),
            name: name.to_string(),
            email: email.to_string(),
        }
    }
}

pub mod errors {
    pub const INVALID_EMAIL: &str = "Invalid email format";
}

const DEFAULT_USER_ID: &str = "1";
static USERS: &[&str] = &["admin", "user"];
`;

/**
 * Run all examples and display results
 *
 * DEMONSTRATION:
 * Shows how to use SymbolParserRegistry to parse code in different languages
 */
export function runAllExamples(): void {
    const registry = SymbolParserRegistry.getInstance();

    const examples = [
        { file: 'example.ts', code: typescriptExample },
        { file: 'example.py', code: pythonExample },
        { file: 'example.cpp', code: cppExample },
        { file: 'example.scala', code: scalaExample },
        { file: 'example.rs', code: rustExample },
    ];

    console.log('='.repeat(80));
    console.log('Symbol Parser Examples');
    console.log('='.repeat(80));

    for (const example of examples) {
        const result = registry.parseFile(example.file, example.code);
        displayParseResult(result);
    }

    displayRegistryStatistics(registry);
}

/**
 * Display parsed symbols from a single file
 */
function displayParseResult(result: ParseResult): void {
    console.log(`\\n${'─'.repeat(80)}`);
    console.log(`File: ${result.filePath}`);
    console.log(`Language: ${result.language}`);

    if (result.error) {
        console.log(`Error: ${result.error}`);
        return;
    }

    console.log(`Symbols found: ${result.symbols.length}`);
    console.log('─'.repeat(80));

    // Group symbols by type
    const grouped = new Map<string, typeof result.symbols>();

    for (const symbol of result.symbols) {
        if (!grouped.has(symbol.type)) {
            grouped.set(symbol.type, []);
        }
        grouped.get(symbol.type)!.push(symbol);
    }

    // Display grouped symbols
    for (const [type, symbols] of grouped.entries()) {
        console.log(`\\n${type.toUpperCase()} (${symbols.length}):`);

        for (const symbol of symbols) {
            const decorators = symbol.decorators?.length
                ? ` [${symbol.decorators.join(', ')}]`
                : '';
            const line = ` Line ${symbol.startLine}: ${symbol.name}${decorators}`;
            console.log(line);

            if (symbol.modifiers?.length) {
                console.log(`    Modifiers: ${symbol.modifiers.join(', ')}`);
            }

            if (symbol.parameters?.length) {
                console.log(`    Parameters: ${symbol.parameters.length}`);
            }

            if (symbol.returnType) {
                console.log(`    Returns: ${symbol.returnType}`);
            }

            if (symbol.parentSymbol) {
                console.log(`    Parent: ${symbol.parentSymbol}`);
            }
        }
    }
}

/**
 * Display registry statistics
 */
function displayRegistryStatistics(registry: SymbolParserRegistry): void {
    console.log(`\\n${'═'.repeat(80)}`);
    console.log('Registry Statistics');
    console.log('═'.repeat(80));

    const stats = registry.getStatistics();
    console.log(`Cached Parsers: ${stats.cachedParsers}`);
    console.log(`Supported Languages: ${stats.supportedLanguages}`);
    console.log(`Supported Extensions: ${stats.supportedExtensions}`);

    console.log(`\\nSupported Languages:`);
    for (const lang of registry.getSupportedLanguages()) {
        console.log(`  - ${lang}`);
    }

    console.log(`\\nSupported Extensions:`);
    for (const ext of registry.getSupportedExtensions()) {
        const lang = registry.getLanguageForFile(`file${ext}`);
        console.log(`  ${ext} → ${lang}`);
    }
}

/**
 * Example: Parse TypeScript file
 */
export function parseTypeScriptFile(content: string): ParseResult {
    const registry = SymbolParserRegistry.getInstance();
    return registry.parseFile('app.ts', content);
}

/**
 * Example: Parse Python file
 */
export function parsePythonFile(content: string): ParseResult {
    const registry = SymbolParserRegistry.getInstance();
    return registry.parseFile('app.py', content);
}

/**
 * Example: Parse C++ file
 */
export function parseCppFile(content: string): ParseResult {
    const registry = SymbolParserRegistry.getInstance();
    return registry.parseFile('app.cpp', content);
}

/**
 * Example: Parse Scala file
 */
export function parseScalaFile(content: string): ParseResult {
    const registry = SymbolParserRegistry.getInstance();
    return registry.parseFile('App.scala', content);
}

/**
 * Example: Parse Rust file
 */
export function parseRustFile(content: string): ParseResult {
    const registry = SymbolParserRegistry.getInstance();
    return registry.parseFile('main.rs', content);
}

/**
 * Example: Parse multiple files
 */
export function parseMultipleFiles(files: Map<string, string>): ParseResult[] {
    const registry = SymbolParserRegistry.getInstance();
    const fileArray = Array.from(files.entries()).map(([filePath, content]) => ({
        filePath,
        content,
    }));
    return registry.parseMultipleFiles(fileArray);
}
