export interface WeatherForecast {
  date: string;
  minTempC: number;
  maxTempC: number;
  condition: string;
  icon: string;
}

export interface WeatherProvider {
  getForecast(lat: number, lng: number, startDate: Date, endDate: Date): Promise<WeatherForecast[]>;
}

export class MockWeatherProvider implements WeatherProvider {
  async getForecast(lat: number, lng: number, startDate: Date, endDate: Date): Promise<WeatherForecast[]> {
    const forecast: WeatherForecast[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      forecast.push({
        date: current.toISOString().split('T')[0],
        minTempC: Math.floor(Math.random() * 10) + 15, // 15-25
        maxTempC: Math.floor(Math.random() * 15) + 25, // 25-40
        condition: ["Sunny", "Partly Cloudy", "Rain", "Clear"][Math.floor(Math.random() * 4)],
        icon: "☀️",
      });
      current.setDate(current.getDate() + 1);
    }
    
    return forecast;
  }
}

export const weatherProvider = new MockWeatherProvider();
