/**
 * 根据占位符格式化字符串
 * @param template 模板字符串，支持 {key} 格式的占位符
 * @param values 替换值对象
 * @returns 格式化后的字符串
 * 
 * @example
 * formatString('Hello {name}, you are {age} years old!', { name: 'John', age: 25 })
 * // 返回: 'Hello John, you are 25 years old!'
 * 
 * formatString('Path: {basePath}/{fileName}.{ext}', { basePath: '/home/user', fileName: 'document', ext: 'txt' })
 * // 返回: 'Path: /home/user/document.txt'
 */
export function formatString(template: string, values: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        const value = values[key];
        return value !== undefined ? String(value) : match;
    });
}

/**
 * 根据占位符格式化字符串（支持数组索引）
 * @param template 模板字符串，支持 {0}, {1}, {key} 等格式的占位符
 * @param values 替换值数组或对象
 * @returns 格式化后的字符串
 * 
 * @example
 * formatStringAdvanced('Hello {0}, you are {1} years old!', ['John', 25])
 * // 返回: 'Hello John, you are 25 years old!'
 * 
 * formatStringAdvanced('User: {name}, Age: {age}, Status: {0}', { name: 'John', age: 25, 0: 'Active' })
 * // 返回: 'User: John, Age: 25, Status: Active'
 */
export function formatStringAdvanced(template: string, values: Record<string | number, any> | any[]): string {
    // 支持多行字符串的占位符匹配，使用's'标志使.可以匹配换行符
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
        let value: any;
        
        // 移除key中可能存在的换行符和空白字符
        key = key.trim();
        
        if (Array.isArray(values)) {
            // 如果values是数组，尝试将key转换为数字索引
            const index = parseInt(key, 10);
            value = !isNaN(index) ? values[index] : undefined;
        } else {
            // 如果values是对象，直接获取属性值
            value = values[key];
        }
        
        // 如果值是多行字符串，保持其格式
        if (typeof value === 'string' && value.includes('\n')) {
            return value;
        }
        
        // 如果值未定义且key包含大写字母，保留原始占位符
        if (value === undefined && /[A-Z]/.test(key)) {
            return match;
        }
        
        return value !== undefined ? String(value) : match;
    });
}