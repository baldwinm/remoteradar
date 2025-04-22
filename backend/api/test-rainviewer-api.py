#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime

def test_rainviewer_api():
    """
    Test the RainViewer API to ensure it's working properly
    """
    print("Testing RainViewer API...")
    
    # Step 1: Get the latest radar frames from the RainViewer API
    api_url = "https://api.rainviewer.com/public/weather-maps.json"
    try:
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        
        print(f"API Response Status: {response.status_code}")
        data = response.json()
        
        print("\nAPI Response Data:")
        print(f"Host: {data.get('host', 'N/A')}")
        print(f"Version: {data.get('version', 'N/A')}")
        
        # Check past radar frames
        past_frames = data.get('radar', {}).get('past', [])
        print(f"\nPast Frames: {len(past_frames)}")
        if past_frames:
            first_frame = past_frames[0]
            last_frame = past_frames[-1]
            print(f"  First frame time: {datetime.fromtimestamp(first_frame.get('time', 0))}")
            print(f"  Last frame time: {datetime.fromtimestamp(last_frame.get('time', 0))}")
            print(f"  Path format: {first_frame.get('path', 'N/A')}")
        
        # Check forecast radar frames
        forecast_frames = data.get('radar', {}).get('nowcast', [])
        print(f"\nForecast Frames: {len(forecast_frames)}")
        if forecast_frames:
            first_frame = forecast_frames[0]
            last_frame = forecast_frames[-1]
            print(f"  First frame time: {datetime.fromtimestamp(first_frame.get('time', 0))}")
            print(f"  Last frame time: {datetime.fromtimestamp(last_frame.get('time', 0))}")
            print(f"  Path format: {first_frame.get('path', 'N/A')}")
        
        # Step 2: Try to fetch a tile from the first past frame
        if past_frames:
            frame = past_frames[-1]  # Get the most recent past frame
            host = data.get('host', '')
            path = frame.get('path', '')
            
            # Coordinates for a sample tile (NYC area)
            x, y, z = 302, 384, 10
            color_scheme = 2  # TITAN
            
            tile_url = f"{host}{path}/256/{z}/{x}/{y}/{color_scheme}/1_1.png"
            print(f"\nFetching sample tile: {tile_url}")
            
            tile_response = requests.get(tile_url, timeout=10)
            print(f"Tile Response Status: {tile_response.status_code}")
            print(f"Tile Content Type: {tile_response.headers.get('Content-Type', 'N/A')}")
            print(f"Tile Size: {len(tile_response.content)} bytes")
            
            # Save the tile to a file to verify it visually
            if tile_response.status_code == 200:
                with open("sample_radar_tile.png", "wb") as f:
                    f.write(tile_response.content)
                print("Saved sample tile to 'sample_radar_tile.png'")
            
            # Try a few different color schemes to verify
            for color_scheme in [1, 4, 8]:
                alt_tile_url = f"{host}{path}/256/{z}/{x}/{y}/{color_scheme}/1_1.png"
                print(f"\nFetching alternate tile with color scheme {color_scheme}: {alt_tile_url}")
                
                alt_response = requests.get(alt_tile_url, timeout=10)
                print(f"Response Status: {alt_response.status_code}")
                
                if alt_response.status_code == 200:
                    with open(f"sample_radar_tile_cs{color_scheme}.png", "wb") as f:
                        f.write(alt_response.content)
                    print(f"Saved sample tile to 'sample_radar_tile_cs{color_scheme}.png'")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Error making API request: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"Error parsing API response: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    test_rainviewer_api()
