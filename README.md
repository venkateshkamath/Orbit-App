# MindLink 🔗

**Connect with like-minded people near you**

A premium proximity-based social networking app built with React Native (Expo) and Django.

![MindLink](https://img.shields.io/badge/MindLink-v1.0.0-purple)
![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2052-blue)
![Django](https://img.shields.io/badge/Django-5.0-green)

## ✨ Features

### 🗺️ Proximity Discovery
- Find people within 10 meters (configurable up to 1km)
- Real-time location tracking
- Interactive map with user markers
- Smart interest-based matching

### 🎯 Interest Matching
- 30+ curated interests across 6 categories
- Match percentage calculation based on common interests
- Visual indicator of shared interests

### 💬 Real-Time Messaging
- WebSocket-based instant messaging
- Typing indicators
- Read receipts
- Message reactions

### 🔐 Secure Authentication
- JWT-based authentication
- Secure token storage
- Password encryption

### 🎨 Premium UI/UX
- Dark theme with vibrant gradients
- Glassmorphism design elements
- Smooth animations with Reanimated
- Beautiful user cards

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed interests
python manage.py seed_interests

# Create superuser (optional)
python manage.py createsuperuser

# Run server
python manage.py runserver
```

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo
npx expo start
```

### Running the App

1. Start the Django backend:
   ```bash
   cd backend && source venv/bin/activate && python manage.py runserver
   ```

2. Start Expo:
   ```bash
   cd mobile && npx expo start
   ```

3. Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS Simulator / `a` for Android Emulator

## 📁 Project Structure

```
├── backend/                 # Django Backend
│   ├── core/               # Project settings
│   ├── users/              # User authentication & profiles
│   ├── chat/               # Messaging & WebSocket
│   ├── discovery/          # Nearby users & matching
│   └── requirements.txt
│
├── mobile/                  # React Native (Expo) App
│   ├── app/                # Expo Router screens
│   │   ├── (auth)/        # Login/Register
│   │   ├── (onboarding)/  # Interests selection
│   │   ├── (tabs)/        # Main app tabs
│   │   └── chat/          # Chat screens
│   ├── src/
│   │   ├── api/           # API client & endpoints
│   │   ├── components/    # Reusable UI components
│   │   ├── stores/        # Zustand state management
│   │   └── types/         # TypeScript definitions
│   └── constants/          # Design system
```

## 🛠️ Tech Stack

### Mobile
- **Framework**: React Native with Expo SDK 52
- **Navigation**: Expo Router (file-based)
- **State**: Zustand
- **Data Fetching**: React Query + Axios
- **Maps**: react-native-maps
- **Location**: expo-location
- **Animations**: react-native-reanimated
- **Styling**: StyleSheet with design tokens

### Backend
- **Framework**: Django 5 + Django REST Framework
- **Auth**: Simple JWT
- **WebSockets**: Django Channels
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **CORS**: django-cors-headers

## 🔧 Configuration

### Backend Environment (.env)

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,10.0.2.2

# JWT Settings
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

### Mobile API Configuration

Update `src/api/client.ts` with your backend URL:

```typescript
export const API_BASE_URL = 'http://YOUR_IP:8000/api';
export const WS_BASE_URL = 'ws://YOUR_IP:8000/ws';
```

For physical devices, use your computer's local IP address.

## 📱 Screenshots

| Discover | Map | Chat | Profile |
|----------|-----|------|---------|
| User cards with match % | Interactive map | Conversations | Settings |

## 🔒 Privacy & Security

- Location data is only shared when the user enables discovery
- Passwords are hashed using Django's PBKDF2
- JWT tokens are stored securely using expo-secure-store
- All API calls use HTTPS in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Made with ❤️ for human connections**
