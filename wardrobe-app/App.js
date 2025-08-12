// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import WardrobeScreen from './screens/WardrobeScreen';
import MyPhotosScreen from './screens/MyPhotosScreen';
import CreateLookScreen from './screens/CreateLookScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Wardrobe" component={WardrobeScreen} />
        <Stack.Screen name="MyPhotos" component={MyPhotosScreen} />
        <Stack.Screen name="CreateLook" component={CreateLookScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
