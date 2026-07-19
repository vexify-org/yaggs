function greet(name: string): string {
    return `Hello, ${name}!`;
}

interface User {
    name: string;
    age: number;
}

const user: User = { name: 'World', age: 25 };

console.log(greet(user.name));

export { greet, User };
