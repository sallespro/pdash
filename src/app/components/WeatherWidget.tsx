import { Cloud, CloudRain, Sun, Wind } from "lucide-react";
import { Card } from "./ui/card";

interface WeatherData {
  current: {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  };
  forecast: {
    day: string;
    temp: number;
    condition: string;
  }[];
}

export function WeatherWidget() {
  // Mock weather data - in a real app, this would come from an API
  const weatherData: WeatherData = {
    current: {
      temp: 72,
      condition: "Partly Cloudy",
      humidity: 65,
      windSpeed: 12,
    },
    forecast: [
      { day: "Wed", temp: 75, condition: "sunny" },
      { day: "Thu", temp: 68, condition: "rainy" },
      { day: "Fri", temp: 70, condition: "cloudy" },
    ],
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "sunny":
        return <Sun className="w-5 h-5 text-yellow-500" />;
      case "rainy":
        return <CloudRain className="w-5 h-5 text-blue-500" />;
      case "cloudy":
        return <Cloud className="w-5 h-5 text-gray-500" />;
      default:
        return <Cloud className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className="p-5 h-full">
      <h2 className="text-lg mb-4">Weather</h2>
      
      {/* Current Weather */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-4xl">{weatherData.current.temp}°F</div>
            <div className="text-sm text-gray-500 mt-1">{weatherData.current.condition}</div>
          </div>
          <Cloud className="w-12 h-12 text-gray-400" />
        </div>
        
        <div className="flex gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Wind className="w-4 h-4" />
            <span>{weatherData.current.windSpeed} mph</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💧</span>
            <span>{weatherData.current.humidity}%</span>
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="grid grid-cols-3 gap-3">
        {weatherData.forecast.map((day) => (
          <div key={day.day} className="text-center bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-600 mb-2">{day.day}</div>
            <div className="flex justify-center mb-2">
              {getWeatherIcon(day.condition)}
            </div>
            <div className="text-sm">{day.temp}°</div>
          </div>
        ))}
      </div>
    </Card>
  );
}