import { useState, useEffect } from 'react';
import { GameLogo } from './components/GameLogo';
import { RaceStatusPanel } from './components/RaceStatusPanel';
import { GlobalStatusBanner } from './components/GlobalStatusBanner';
import { CountdownOverlay } from './components/CountdownOverlay';
import { Minimap } from './components/Minimap';
import { EngineHeatIndicator } from './components/EngineHeatIndicator';
import { PackageStatusPanel } from './components/PackageStatusPanel';
import { MotorcycleDashboard } from './components/MotorcycleDashboard';
import { InventoryPanel } from './components/InventoryPanel';
import { TurboResourcePanel } from './components/TurboResourcePanel';
import { WeatherEventNotification } from './components/WeatherEventNotification';
import { WeatherOverlay } from './components/WeatherOverlay';
import { WeatherHUDIndicator } from './components/WeatherHUDIndicator';
import { WeatherControlPanel } from './components/WeatherControlPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { ReturnToLobbyPanel } from './components/ReturnToLobbyPanel';
import { MainMenu } from './components/MainMenu';
import { LobbyScreen } from './components/LobbyScreen';

type GameState = 'menu' | 'lobby' | 'countdown' | 'racing' | 'finished';
type WeatherType = 'rain' | 'sunny' | 'night' | null;

interface Player {
  id: string;
  name: string;
  isReady: boolean;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [countdown, setCountdown] = useState<number | null>(3);
  const [raceTime, setRaceTime] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [rpm, setRpm] = useState(0);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'info' | 'warning' | 'turbo'>('info');
  const [weatherEvent, setWeatherEvent] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherType>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState(10);

  // Mock dynamic data
  const [heatPercentage, setHeatPercentage] = useState(45);
  const [packageIntegrity, setPackageIntegrity] = useState(92);

  // Lobby state
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'You', isReady: false },
    { id: '2', name: 'SpeedDemon', isReady: false },
    { id: '3', name: 'RoadRunner', isReady: false }
  ]);
  const [currentPlayerId] = useState('1');
  const [lobbyRaceCountdown, setLobbyRaceCountdown] = useState<number | null>(null);

  // Countdown logic
  useEffect(() => {
    if (gameState === 'countdown' && countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        // Start race
        setTimeout(() => {
          setCountdown(null);
          setGameState('racing');
          setGlobalMessage('TURBO ACTIVATED!');
          setMessageType('turbo');
          setTimeout(() => setGlobalMessage(null), 2000);
        }, 500);
      }
    }
  }, [countdown, gameState]);

  // Race timer
  useEffect(() => {
    if (gameState === 'racing') {
      const timer = setInterval(() => {
        setRaceTime((t) => t + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  // Simulate speed and RPM changes
  useEffect(() => {
    if (gameState === 'racing') {
      const interval = setInterval(() => {
        setSpeed((s) => Math.min(180, s + Math.random() * 20 - 8));
        setRpm((r) => Math.min(9500, r + Math.random() * 1000 - 400));
        setHeatPercentage((h) => Math.min(100, Math.max(20, h + Math.random() * 10 - 5)));
        setPackageIntegrity((p) => Math.max(0, p - Math.random() * 2));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  // Weather event simulation
  useEffect(() => {
    if (gameState === 'racing') {
      const weatherTimer = setTimeout(() => {
        setWeatherEvent('Heavy Rain');
        setWeather('rain');
        setGlobalMessage('Weather Event Starting');
        setMessageType('warning');
        setTimeout(() => setGlobalMessage(null), 2000);
      }, 15000);
      return () => clearTimeout(weatherTimer);
    }
  }, [gameState]);

  // Handle weather change from control panel
  const handleWeatherChange = (newWeather: WeatherType) => {
    setWeather(newWeather);
    
    if (newWeather) {
      // Set weather event name based on type
      const eventNames = {
        rain: 'Heavy Rain',
        sunny: 'Sunny Weather',
        night: 'Night Event'
      };
      setWeatherEvent(eventNames[newWeather]);
      
      // Show notification
      const messages = {
        rain: 'Rain incoming',
        sunny: 'Sunny weather active',
        night: 'Night event starting'
      };
      setGlobalMessage(messages[newWeather]);
      setMessageType('info');
      setTimeout(() => setGlobalMessage(null), 2000);
    } else {
      setWeatherEvent(null);
    }
  };

  // End race after 2 minutes
  useEffect(() => {
    if (gameState === 'racing' && raceTime >= 120) {
      setGameState('finished');
    }
  }, [raceTime, gameState]);

  // Lobby countdown
  useEffect(() => {
    if (gameState === 'finished') {
      const timer = setInterval(() => {
        setLobbyCountdown((c) => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  // Lobby race countdown
  useEffect(() => {
    if (gameState === 'lobby' && lobbyRaceCountdown !== null) {
      if (lobbyRaceCountdown > 0) {
        const timer = setTimeout(() => setLobbyRaceCountdown(lobbyRaceCountdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        // Start race countdown
        setGameState('countdown');
        setCountdown(3);
        setLobbyRaceCountdown(null);
      }
    }
  }, [lobbyRaceCountdown, gameState]);

  // Check if all players ready in lobby
  useEffect(() => {
    if (gameState === 'lobby' && lobbyRaceCountdown === null) {
      const allReady = players.length >= 2 && players.every((p) => p.isReady);
      if (allReady) {
        // Start countdown
        setLobbyRaceCountdown(10);
      }
    }
  }, [players, gameState, lobbyRaceCountdown]);

  // Menu handlers
  const handlePublicMatch = () => {
    setGameState('lobby');
    // Reset players
    setPlayers([
      { id: '1', name: 'You', isReady: false },
      { id: '2', name: 'SpeedDemon', isReady: false },
      { id: '3', name: 'RoadRunner', isReady: false }
    ]);
  };

  const handlePrivateMatch = () => {
    setGameState('lobby');
    setPlayers([{ id: '1', name: 'You', isReady: false }]);
  };

  const handleSettings = () => {
    alert('Settings menu coming soon!');
  };

  const handleExtra = () => {
    alert('Tournaments feature coming soon!');
  };

  // Lobby handlers
  const handleToggleReady = () => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentPlayerId ? { ...p, isReady: !p.isReady } : p
      )
    );
  };

  const handleLeaveLobby = () => {
    setGameState('menu');
    setLobbyRaceCountdown(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const mockResults = [
    { rank: 1, name: 'SpeedDemon', totalTime: '2:03.45', timeDifference: '', deliveryQuality: 95 },
    { rank: 2, name: 'RoadRunner', totalTime: '2:08.12', timeDifference: '4.67', deliveryQuality: 88 },
    { rank: 3, name: 'FastLane', totalTime: '2:11.89', timeDifference: '8.44', deliveryQuality: 92 },
    { rank: 4, name: 'TurboKid', totalTime: '2:15.23', timeDifference: '11.78', deliveryQuality: 76 },
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Asphalt Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `
            linear-gradient(135deg, #0F141D 0%, #1A2332 100%)
          `
        }}
      >
        {/* Asphalt texture overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.03) 10px,
                rgba(255, 255, 255, 0.03) 20px
              )
            `
          }}
        />
        {/* Road reflection effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse at bottom, rgba(100, 150, 200, 0.15) 0%, transparent 60%)'
          }}
        />
      </div>

      {/* Game Logo */}
      <GameLogo />

      {/* Main Menu */}
      {gameState === 'menu' && (
        <MainMenu
          onPublicMatch={handlePublicMatch}
          onPrivateMatch={handlePrivateMatch}
          onSettings={handleSettings}
          onExtra={handleExtra}
        />
      )}

      {/* Lobby Screen */}
      {gameState === 'lobby' && (
        <LobbyScreen
          players={players}
          currentPlayerId={currentPlayerId}
          isReady={players.find((p) => p.id === currentPlayerId)?.isReady || false}
          countdown={lobbyRaceCountdown}
          onToggleReady={handleToggleReady}
          onLeaveLobby={handleLeaveLobby}
        />
      )}

      {/* Weather Overlay */}
      <WeatherOverlay weather={weather} />

      {/* Countdown Overlay */}
      {gameState === 'countdown' && <CountdownOverlay count={countdown} />}

      {/* Racing HUD */}
      {(gameState === 'racing' || gameState === 'countdown') && (
        <>
          {/* Top Left - Race Status */}
          <RaceStatusPanel
            currentOrder={2}
            totalOrders={3}
            destination="Downtown Plaza - Building C"
            raceTimer={formatTime(raceTime)}
            countdown={gameState === 'countdown' ? countdown : null}
          />

          {/* Top Center - Global Status Banner */}
          <GlobalStatusBanner message={globalMessage} type={messageType} />

          {/* Top Center - Weather Event */}
          {weatherEvent && (
            <WeatherEventNotification
              eventName={weatherEvent}
              eventStatus="Active"
              remainingTime={45}
            />
          )}

          {/* Top Right - Minimap */}
          <Minimap
            playerPosition={{ x: 45, y: 60 }}
            otherPlayers={[
              { id: '1', x: 30, y: 40 },
              { id: '2', x: 70, y: 80 },
              { id: '3', x: 55, y: 25 }
            ]}
            targetPosition={{ x: 75, y: 35 }}
          />

          {/* Engine Heat */}
          <EngineHeatIndicator
            heatPercentage={heatPercentage}
            status={heatPercentage > 80 ? 'overheating' : heatPercentage < 30 ? 'cooling' : 'stable'}
          />

          {/* Weather HUD Indicator */}
          <WeatherHUDIndicator weather={weather} />

          {/* Bottom Left - Package Status */}
          <PackageStatusPanel
            packageIntegrity={packageIntegrity}
            averageQuality={85}
          />

          {/* Bottom Right - Motorcycle Dashboard */}
          <MotorcycleDashboard
            speed={Math.round(speed)}
            rpm={Math.round(rpm)}
            health={78}
            repairStatus="Auto-repair: 15s"
          />

          {/* Inventory */}
          <InventoryPanel
            slot1={{ id: '1', name: 'Oil Slick', count: 2 }}
            slot2={null}
            dropKey="X"
          />

          {/* Bottom Center - Turbo */}
          <TurboResourcePanel turboCount={3} />
        </>
      )}

      {/* End Race Screen */}
      {gameState === 'finished' && (
        <>
          <ResultsPanel results={mockResults} />
          <ReturnToLobbyPanel
            countdown={lobbyCountdown}
            onReturn={() => {
              // Return to main menu
              setGameState('menu');
              setRaceTime(0);
              setSpeed(0);
              setRpm(0);
              setHeatPercentage(45);
              setPackageIntegrity(92);
              setWeatherEvent(null);
              setWeather(null);
              setLobbyCountdown(10);
            }}
          />
        </>
      )}

      {/* Weather Control Panel - Always visible */}
      <WeatherControlPanel
        onWeatherChange={handleWeatherChange}
        currentWeather={weather}
      />

      {/* Demo Controls */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
        <div className="flex flex-col gap-4 items-center pointer-events-auto">
          {gameState === 'racing' && (
            <button
              onClick={() => setGameState('finished')}
              className="px-6 py-3 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 16px rgba(255, 107, 53, 0.6)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Skip to Results
            </button>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes rainDrop {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}