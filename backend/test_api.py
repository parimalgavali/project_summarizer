#!/usr/bin/env python3
"""
Simple API test script to test file upload
"""
import requests

def test_api():
    # Test file path
    test_file = "tests/samples/sample.pdf"

    try:
        # Check if file exists
        with open(test_file, 'rb') as f:
            content = f.read()

        print(f"Testing with file: {test_file}")
        print(f"File size: {len(content)} bytes")

        # Send API request
        files = {'file': open(test_file, 'rb')}
        response = requests.post('http://localhost:8000/documents/upload', files=files)

        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'text_ready':
                print(f"SUCCESS! Extracted {data.get('message', 'unknown')} words")
            else:
                print(f" File uploaded but text extraction status: {data.get('status')}")
        else:
            print(f"API call failed")

    except FileNotFoundError:
        print(f"File not found: {test_file}")
    except requests.exceptions.ConnectionError:
        print("Cannot connect to backend. Is uvicorn running?")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
