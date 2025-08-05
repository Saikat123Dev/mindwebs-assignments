
const hoursToDate = (hours: number): Date => {
  const baseDate = new Date();
  return new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const fetchTemperature = async (
  lat: number,
  lng: number,
  dataSource: string,
  timeRange?: { start: number; end: number }
): Promise<number | null> => {
  let startDate: string;
  let endDate: string;
  console.log(timeRange)
  if (timeRange) {
    startDate = formatDate(hoursToDate(timeRange.start));
    endDate = formatDate(hoursToDate(timeRange.end));
  } else {

    endDate = new Date().toISOString().split('T')[0];
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  console.log(startDate, endDate)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&hourly=${dataSource}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const values: number[] = data?.hourly?.[dataSource];
    const times: string[] = data?.hourly?.time;

    if (!values || values.length === 0 || !times) return null;

    if (timeRange) {
      const startTime = hoursToDate(timeRange.start);
      const endTime = hoursToDate(timeRange.end);

      const filteredData = values.filter((_, index) => {
        const dataTime = new Date(times[index]);
        return dataTime >= startTime && dataTime <= endTime;
      });

      if (filteredData.length === 0) return null;

      // Calculate average for the filtered time range
      const avg = filteredData.reduce((sum, val) => sum + (val || 0), 0) / filteredData.length;
      return parseFloat(avg.toFixed(1));
    }

    // Default behavior: average all values
    const validValues = values.filter(val => val !== null && val !== undefined);
    if (validValues.length === 0) return null;

    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    return parseFloat(avg.toFixed(1));
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
};


export const calculateHourlyAverages = (
  values: number[],
  times: string[],
  timeRange: { start: number; end: number }
): { hourlyAverages: number[]; labels: string[] } => {
  const startTime = hoursToDate(timeRange.start);
  const endTime = hoursToDate(timeRange.end);

  const hourlyData: { [hour: string]: number[] } = {};

  // Group data by hour
  values.forEach((value, index) => {
    if (value === null || value === undefined) return;

    const dataTime = new Date(times[index]);
    if (dataTime < startTime || dataTime > endTime) return;

    const hourKey = dataTime.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    if (!hourlyData[hourKey]) {
      hourlyData[hourKey] = [];
    }
    hourlyData[hourKey].push(value);
  });

  // Calculate averages for each hour
  const hourlyAverages: number[] = [];
  const labels: string[] = [];

  Object.keys(hourlyData)
    .sort()
    .forEach(hour => {
      const hourValues = hourlyData[hour];
      const avg = hourValues.reduce((sum, val) => sum + val, 0) / hourValues.length;
      hourlyAverages.push(parseFloat(avg.toFixed(1)));
      labels.push(hour.replace('T', ' ') + ':00');
    });

  return { hourlyAverages, labels };
};
