/**
 * Format string based on placeholders
 * @param template Template string, supports {key} format placeholders
 * @param values Replacement value object
 * @returns Formatted string
 * 
 * @example
 * formatString('Hello {name}, you are {age} years old!', { name: 'John', age: 25 })
 * // Returns: 'Hello John, you are 25 years old!'
 * 
 * formatString('Path: {basePath}/{fileName}.{ext}', { basePath: '/home/user', fileName: 'document', ext: 'txt' })
 * // Returns: 'Path: /home/user/document.txt'
 */
export function formatString(template: string, values: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        const value = values[key];
        return value !== undefined ? String(value) : match;
    });
}

/**
 * Format string based on placeholders (supports array indices)
 * @param template Template string, supports {0}, {1}, {key} format placeholders
 * @param values Replacement value array or object
 * @returns Formatted string
 * 
 * @example
 * formatStringAdvanced('Hello {0}, you are {1} years old!', ['John', 25])
 * // Returns: 'Hello John, you are 25 years old!'
 * 
 * formatStringAdvanced('User: {name}, Age: {age}, Status: {0}', { name: 'John', age: 25, 0: 'Active' })
 * // Returns: 'User: John, Age: 25, Status: Active'
 */
export function formatStringAdvanced(template: string, values: Record<string | number, any> | any[]): string {
    // Support placeholder matching for multi-line strings, use 's' flag to make . match newlines
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        let value: any;
        
        // Remove possible newlines and whitespace characters in key
        key = key.trim();
        
        if (Array.isArray(values)) {
            // If values is an array, try to convert key to numeric index
            const index = parseInt(key, 10);
            value = !isNaN(index) ? values[index] : undefined;
        } else {
            // If values is an object, get property value directly
            value = values[key];
        }
        
        // If value is a multi-line string, preserve its format
        if (typeof value === 'string' && value.includes('\n')) {
            return value;
        }
        
        // If value is undefined and key contains uppercase letters, preserve original placeholder
        if (value === undefined && /[A-Z]/.test(key)) {
            return match;
        }
        
        return value !== undefined ? String(value) : match;
    });
}