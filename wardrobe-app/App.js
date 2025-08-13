// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LanguageProvider } from './i18n/LanguageProvider';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import WardrobeScreen from './screens/WardrobeScreen';
import CreateLookScreen from './screens/CreateLookScreen';
import AddItemDetailsScreen from './screens/AddItemDetailsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import AddLookDetailsScreen from './screens/AddLookDetailsScreen';
import LookDetailsScreen from './screens/LookDetailsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    </LanguageProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="Wardrobe"
            component={WardrobeScreen}
            options={({ route }) => ({
              animation: route?.params?.animation ?? 'default',
            })}
          />
          <Stack.Screen name="CreateLook" component={CreateLookScreen} />
          <Stack.Screen name="LookDetails" component={LookDetailsScreen} />
          <Stack.Screen name="AddLookDetails" component={AddLookDetailsScreen} />
          <Stack.Screen name="AddItemDetails" component={AddItemDetailsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={({ route }) => ({
              animation: route?.params?.animation ?? 'default',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
}
