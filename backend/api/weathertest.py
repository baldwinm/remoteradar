# A simple Python script to test the weather API directly
import requests

response = requests.get(
    "https://api.open-meteo.com/v1/forecast",
    params={
        'latitude': 34.74,
        'longitude': -86.58,
        'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
        'timezone': 'auto'
    }
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")