import { formatString, formatStringAdvanced } from './stringFormatter';

// Test basic formatting function
console.log('=== Test formatString function ===');

// Test case 1: Basic string replacement
const result1 = formatString('Hello {name}, you are {age} years old!', { name: 'John', age: 25 });
console.log('Test 1:', result1);
// Expected output: Hello John, you are 25 years old!

// Test case 2: Path formatting
const result2 = formatString('Path: {basePath}/{fileName}.{ext}', { 
    basePath: '/home/user', 
    fileName: 'document', 
    ext: 'txt' 
});
console.log('Test 2:', result2);
// Expected output: Path: /home/user/document.txt

// Test case 3: Missing placeholder values
const result3 = formatString('Hello {name}, you are {age} years old!', { name: 'Alice' });
console.log('Test 3:', result3);
// Expected output: Hello Alice, you are {age} years old!

// Test case 4: Empty object
const result4 = formatString('No {replacements} here', {});
console.log('Test 4:', result4);
// Expected output: No {replacements} here

console.log('\n=== Test formatStringAdvanced function ===');

// Test case 5: Array index replacement
const result5 = formatStringAdvanced('Hello {0}, you are {1} years old!', ['John', 25]);
console.log('Test 5:', result5);
// Expected output: Hello John, you are 25 years old!

// Test case 6: Mixed object and numeric indices
const result6 = formatStringAdvanced('User: {name}, Age: {age}, Status: {0}', { 
    name: 'John', 
    age: 25, 
    0: 'Active' 
});
console.log('Test 6:', result6);
// Expected output: User: John, Age: 25, Status: Active

// Test case 7: Array out of bounds
const result7 = formatStringAdvanced('Items: {0}, {1}, {2}', ['First', 'Second']);
console.log('Test 7:', result7);
// Expected output: Items: First, Second, {2}

// Test case 8: Complex template
const result8 = formatString(
    'Welcome to {appName}! Today is {date} and the weather is {weather}.', 
    { 
        appName: 'MyApp', 
        date: '2024-01-15', 
        weather: 'sunny' 
    }
);
console.log('Test 8:', result8);
// Expected output: Welcome to MyApp! Today is 2024-01-15 and the weather is sunny.

// Test case 9: enhanceCellChatResponseSchema basic replacement
const enhanceCellSchema = `
    export interface EnhanceCellChatResponse {
        response: string; // the request's response content
        contentType: {contentType}; // the content type
    }
`;
const result9 = formatStringAdvanced(enhanceCellSchema, {contentType: 'javascript code'});
console.log('Test 9:', result9);
// Expected output: {contentType} in schema replaced with 'javascript code'

// Test case 10: enhanceCellChatResponseSchema multiple value replacement
const result10 = formatStringAdvanced(enhanceCellSchema, {
    contentType: 'python code',
    otherValue: 'not used'
});
console.log('Test 10:', result10);
// Expected output: {contentType} in schema replaced with 'python code', other values don't affect result

// Test case 11: enhanceCellChatResponseSchema no replacement values
const result11 = formatStringAdvanced(enhanceCellSchema, {});
console.log('Test 11:', result11);
// Expected output: {contentType} in schema remains unchanged

console.log('\nAll tests completed!');