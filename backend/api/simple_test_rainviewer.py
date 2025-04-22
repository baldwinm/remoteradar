#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import os

def test_rainviewer_api():
    """
    Test the RainViewer API to ensure it's working properly, and find areas with precipitation
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
        
        # Use the most recent past frame
        if past_frames:
            frame = past_frames[-1]
            host = data.get('host', '')
            path = frame.get('path', '')
            
            # Create a results folder
            results_folder = "rainviewer_test_results"
            if not os.path.exists(results_folder):
                os.makedirs(results_folder)
                
            # Test different areas around the world to find precipitation
            test_locations = [
                {"name": "New York", "x": 302, "y": 384, "z": 10},
                {"name": "Los Angeles", "x": 173, "y": 396, "z": 10},
                {"name": "Chicago", "x": 261, "y": 379, "z": 10},
                {"name": "Miami", "x": 279, "y": 409, "z": 10},
                {"name": "Seattle", "x": 166, "y": 372, "z": 10},
                {"name": "Dallas", "x": 232, "y": 401, "z": 10},
                {"name": "London", "x": 511, "y": 340, "z": 10},
                {"name": "Paris", "x": 520, "y": 345, "z": 10},
                {"name": "Berlin", "x": 532, "y": 337, "z": 10},
                {"name": "Tokyo", "x": 884, "y": 379, "z": 10},
                {"name": "Sydney", "x": 916, "y": 461, "z": 10},
                {"name": "Rio de Janeiro", "x": 338, "y": 460, "z": 10}
            ]
            
            print("\nTesting different locations to find precipitation data:")
            found_precipitation = False
            
            for location in test_locations:
                # Try different color schemes (2 = TITAN is the default)
                color_scheme = 2
                
                # Create the tile URL
                tile_url = f"{host}{path}/256/{location['z']}/{location['x']}/{location['y']}/{color_scheme}/1_1.png"
                print(f"\nTesting {location['name']}: {tile_url}")
                
                # Fetch the tile
                tile_response = requests.get(tile_url, timeout=10)
                print(f"  Response Status: {tile_response.status_code}")
                
                if tile_response.status_code == 200:
                    content_type = tile_response.headers.get('Content-Type', 'N/A')
                    content_length = len(tile_response.content)
                    print(f"  Content Type: {content_type}")
                    print(f"  Content Length: {content_length} bytes")
                    
                    # Save the tile
                    filename = f"{results_folder}/radar_tile_{location['name'].replace(' ', '_')}.png"
                    with open(filename, "wb") as f:
                        f.write(tile_response.content)
                    
                    # Check if the tile might have precipitation (simplistic approach)
                    # A non-empty tile (larger than 500 bytes) might have precipitation
                    if content_length > 500:
                        print(f"  ✓ POTENTIAL PRECIPITATION FOUND! Content size: {content_length} bytes")
                        print(f"  Check the file at: {filename}")
                        found_precipitation = True
                    else:
                        print(f"  ✗ Likely no precipitation data (small file size: {content_length} bytes)")
                
                else:
                    print(f"  ✗ Failed to fetch tile")
            
            if found_precipitation:
                print("\n✓ POTENTIAL PRECIPITATION DATA FOUND in at least one location!")
                print("Check the saved PNG files in the results folder to confirm visually.")
            else:
                print("\n✗ NO PRECIPITATION DATA FOUND in any tested location.")
                print("This could mean there's currently no precipitation in any of the tested areas,")
                print("or there might be an issue with the API or your radar implementation.")
            
            return found_precipitation
        
        else:
            print("No past frames available in the API response.")
            return False
            
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
