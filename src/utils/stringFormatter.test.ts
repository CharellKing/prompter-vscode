import { formatString, formatStringAdvanced } from './stringFormatter';

// 测试基础格式化函数
console.log('=== 测试 formatString 函数 ===');

// 测试用例1：基本字符串替换
const result1 = formatString('Hello {name}, you are {age} years old!', { name: 'John', age: 25 });
console.log('测试1:', result1);
// 期望输出: Hello John, you are 25 years old!

// 测试用例2：路径格式化
const result2 = formatString('Path: {basePath}/{fileName}.{ext}', { 
    basePath: '/home/user', 
    fileName: 'document', 
    ext: 'txt' 
});
console.log('测试2:', result2);
// 期望输出: Path: /home/user/document.txt

// 测试用例3：缺少占位符值
const result3 = formatString('Hello {name}, you are {age} years old!', { name: 'Alice' });
console.log('测试3:', result3);
// 期望输出: Hello Alice, you are {age} years old!

// 测试用例4：空对象
const result4 = formatString('No {replacements} here', {});
console.log('测试4:', result4);
// 期望输出: No {replacements} here

console.log('\n=== 测试 formatStringAdvanced 函数 ===');

// 测试用例5：数组索引替换
const result5 = formatStringAdvanced('Hello {0}, you are {1} years old!', ['John', 25]);
console.log('测试5:', result5);
// 期望输出: Hello John, you are 25 years old!

// 测试用例6：混合对象和数字索引
const result6 = formatStringAdvanced('User: {name}, Age: {age}, Status: {0}', { 
    name: 'John', 
    age: 25, 
    0: 'Active' 
});
console.log('测试6:', result6);
// 期望输出: User: John, Age: 25, Status: Active

// 测试用例7：数组越界
const result7 = formatStringAdvanced('Items: {0}, {1}, {2}', ['First', 'Second']);
console.log('测试7:', result7);
// 期望输出: Items: First, Second, {2}

// 测试用例8：复杂模板
const result8 = formatString(
    'Welcome to {appName}! Today is {date} and the weather is {weather}.', 
    { 
        appName: 'MyApp', 
        date: '2024-01-15', 
        weather: 'sunny' 
    }
);
console.log('测试8:', result8);
// 期望输出: Welcome to MyApp! Today is 2024-01-15 and the weather is sunny.

// 测试用例9：enhanceCellChatResponseSchema基本替换
const enhanceCellSchema = `
    export interface EnhanceCellChatResponse {
        response: string; // the request's response content
        contentType: {contentType}; // the content type
    }
`;
const result9 = formatStringAdvanced(enhanceCellSchema, {contentType: 'javascript code'});
console.log('测试9:', result9);
// 期望输出: schema中的{contentType}被替换为'javascript code'

// 测试用例10：enhanceCellChatResponseSchema多值替换
const result10 = formatStringAdvanced(enhanceCellSchema, {
    contentType: 'python code',
    otherValue: 'not used'
});
console.log('测试10:', result10);
// 期望输出: schema中的{contentType}被替换为'python code'，其他值不影响结果

// 测试用例11：enhanceCellChatResponseSchema无替换值
const result11 = formatStringAdvanced(enhanceCellSchema, {});
console.log('测试11:', result11);
// 期望输出: schema中的{contentType}保持不变

console.log('\n所有测试完成！');