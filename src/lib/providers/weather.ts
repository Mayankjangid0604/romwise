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
    
    // Simple deterministic heuristic based on latitude and month
    const isWinter = startDate.getMonth() <= 2 || startDate.getMonth() >= 10;
    const isMonsoon = startDate.getMonth() >= 6 && startDate.getMonth() <= 8;
    const isMountain = lat > 30; // rough heuristic for Himalayas

    let baseMin = 20;
    let baseMax = 32;

    if (isMountain) {
      baseMin = isWinter ? -5 : 10;
      baseMax = isWinter ? 5 : 22;
    } else if (isWinter) {
      baseMin = 10;
      baseMax = 24;
    }

    while (current <= endDate) {
      let condition = "Clear";
      let icon = "sun";

      if (isMonsoon) {
        condition = "Rain";
        icon = "cloud-rain";
      } else if (isMountain && isWinter) {
        condition = "Snow";
        icon = "snowflake";
      } else if (current.getDate() % 3 === 0) {
        condition = "Partly Cloudy";
        icon = "cloud-sun";
      }

      forecast.push({
        date: current.toISOString().split('T')[0],
        minTempC: baseMin + (current.getDate() % 3),
        maxTempC: baseMax + (current.getDate() % 4),
        condition,
        icon,
      });
      current.setDate(current.getDate() + 1);
    }
    
    return forecast;
  }
}

export const weatherProvider = new MockWeatherProvider();
