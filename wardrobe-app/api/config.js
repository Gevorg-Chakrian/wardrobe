// LOCAL
export const BACKEND_URL = 'http://192.168.1.72:5000';

// RENDER
//export const BACKEND_URL = 'https://wardrobe-f8h2.onrender.com';

// Derived bases
export const AUTH_BASE_URL = `${BACKEND_URL}/api/auth`; // login/register
export const API_BASE_URL  = `${BACKEND_URL}/api`;      // wardrobe, upload, extract, etc.