import os
import logging
import requests
from typing import Dict, Any, Optional, List, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("queryclip.notion")

class NotionService:
    """Service for interacting with Notion API"""
    
    def __init__(self):
        self.api_key = os.getenv('NOTION_API_KEY')
        self.database_id = os.getenv('NOTION_DATABASE_ID')
        self.api_url = "https://api.notion.com/v1"
        self.version = "2022-06-28"  # Notion API version
        self.database_properties = None
        
        if not self.api_key:
            logger.warning("Notion API key not found in environment variables")
        
        if not self.database_id:
            logger.warning("Notion database ID not found in environment variables")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Notion API requests"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Notion-Version": self.version
        }
    
    def is_configured(self) -> bool:
        """Check if Notion API is configured properly"""
        return bool(self.api_key and self.database_id)
    
    def check_database_access(self) -> Tuple[bool, str]:
        """
        Check if we can access the database and get its properties
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        if not self.is_configured():
            return False, "Notion API is not configured. Please set NOTION_API_KEY and NOTION_DATABASE_ID."
        
        try:
            # Validate database_id format
            if not self.database_id or len(self.database_id) < 32:
                return False, f"Invalid database ID format: '{self.database_id}'. Should be a 32+ character string."
                
            logger.info(f"Checking database access for ID: {self.database_id}")
            try:
                response = requests.get(
                    f"{self.api_url}/databases/{self.database_id}",
                    headers=self._get_headers(),
                    timeout=10  # Add timeout to prevent hanging
                )
                
                logger.info(f"Database access response status: {response.status_code}")
                
                if response.status_code == 200:
                    # Store database properties for later use
                    data = response.json()
                    self.database_properties = data.get('properties', {})
                    property_names = list(self.database_properties.keys())
                    logger.info(f"Database properties found: {property_names}")
                    
                    # Verify essential properties exist
                    title_props = [prop for prop, details in self.database_properties.items() 
                                 if details.get('type') == 'title']
                    if not title_props:
                        return False, "No title property found in database. A title property is required."
                        
                    return True, "Successfully connected to Notion database"
                elif response.status_code == 404:
                    return False, "Database not found. Make sure the database ID is correct and the database is shared with your integration."
                elif response.status_code == 401:
                    return False, "Unauthorized. Check your API key."
                else:
                    return False, f"Error accessing database: {response.status_code} - {response.text}"
            except requests.exceptions.Timeout:
                return False, "Connection to Notion API timed out"
            except requests.exceptions.ConnectionError:
                return False, "Connection error. Please check your internet connection"                
        except Exception as e:
            logger.exception("Unexpected error accessing database")
            return False, f"Exception accessing database: {str(e)}"
    
    def get_database_properties(self) -> List[str]:
        """
        Get list of available property names in the database
        
        Returns:
            List of property names
        """
        if self.database_properties is None:
            success, _ = self.check_database_access()
            if not success:
                return []
                
        return list(self.database_properties.keys())
    
    def save_video_to_notion(self, title: str, video_id: str, author: str = "QueryClip", publisher: str = "QueryClip",
                          description: Optional[str] = None, transcript: Optional[List] = None, 
                          notes: Optional[str] = None, screenshots: Optional[List] = None,
                          transcript_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """Save video information to Notion database with enhanced error handling and format validation.
        
        This method attempts to handle various data formats for transcript and screenshots,
        ensuring they can be properly processed regardless of their structure.
        """
        """
        Save video information to the Notion database
        
        Args:
            title: Title of the video
            video_id: YouTube video ID
            author: Author of the content (default: QueryClip)
            publisher: Publisher of the content (default: QueryClip)
            
        Returns:
            Response from Notion API
        """
        # First check database access and verify credentials
        success, message = self.check_database_access()
        if not success:
            logger.error(f"Database access failed: {message}")
            return {"error": f"Notion database access failed: {message}. Please check your API key and database ID."}
        
        try:
            # Log received data
            logger.info(f"Saving to Notion - Title: {title}, Video ID: {video_id}")
            logger.info(f"Description: {type(description).__name__} ({len(description) if description else 0} chars)")
            logger.info(f"Transcript: {type(transcript).__name__} ({len(transcript) if transcript and hasattr(transcript, '__len__') else 'N/A'})")
            logger.info(f"Notes: {type(notes).__name__} ({len(notes) if notes else 0} chars)")
            logger.info(f"Screenshots: {type(screenshots).__name__} ({len(screenshots) if screenshots and hasattr(screenshots, '__len__') else 'N/A'})")
            
            # Create video URL
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            
            # Prepare payload for Notion API
            properties = {}
            
            # Only add properties that exist in the database
            if "Name" in self.database_properties:
                properties["Name"] = {
                    "title": [{"text": {"content": title}}]
                }
            else:
                logger.warning("'Name' property not found in database, but it's required for title")
                # Try to find a title property with a different name
                title_props = [prop for prop, details in self.database_properties.items() 
                              if details.get('type') == 'title']
                if title_props:
                    properties[title_props[0]] = {
                        "title": [{"text": {"content": title}}]
                    }
                else:
                    return {"error": "No title property found in database. Every Notion database needs a title property."}
            
            # Add Author if it exists
            if "Author" in self.database_properties:
                prop_type = self.database_properties["Author"].get('type')
                if prop_type == 'rich_text':
                    properties["Author"] = {
                        "rich_text": [{"text": {"content": author}}]
                    }
                elif prop_type == 'select':
                    properties["Author"] = {
                        "select": {"name": author}
                    }
                # Add other property types as needed
            
            # Add Publisher if it exists
            if "Publisher" in self.database_properties:
                prop_type = self.database_properties["Publisher"].get('type')
                if prop_type == 'rich_text':
                    properties["Publisher"] = {
                        "rich_text": [{"text": {"content": publisher}}]
                    }
                elif prop_type == 'select':
                    properties["Publisher"] = {
                        "select": {"name": publisher}
                    }
            
            # Add URL if it exists
            if "URL" in self.database_properties:
                properties["URL"] = {"url": video_url}
            
            # Add Description if available and property exists
            if description and "Description" in self.database_properties:
                prop_type = self.database_properties["Description"].get('type')
                if prop_type == 'rich_text':
                    # Truncate if too long for Notion's 2000 character limit
                    desc_content = description[:2000] if description else ""
                    properties["Description"] = {
                        "rich_text": [{"text": {"content": desc_content}}]
                    }
            
            # Add Notes if available and property exists
            if notes and "Notes" in self.database_properties:
                prop_type = self.database_properties["Notes"].get('type')
                if prop_type == 'rich_text':
                    # Truncate if too long
                    notes_content = notes[:2000] if notes else ""
                    properties["Notes"] = {
                        "rich_text": [{"text": {"content": notes_content}}]
                    }
                    
            # Add Transcript content if available and property exists
            if transcript and "Transcript" in self.database_properties:
                prop_type = self.database_properties["Transcript"].get('type')
                
                if prop_type == 'rich_text':
                    # Format transcript based on its structure
                    transcript_text = ""
                    
                    # Handle different transcript formats
                    if isinstance(transcript, list):
                        if len(transcript) > 0:
                            # Check the format of transcript items
                            first_item = transcript[0]
                            logger.info(f"Transcript first item type: {type(first_item).__name__}")
                            logger.info(f"Transcript first item sample: {str(first_item)[:100]}")
                            
                            if isinstance(first_item, dict):
                                # Handle dictionary format with start/end/text keys
                                if all(key in first_item for key in ['start', 'text']):
                                    logger.info("Processing transcript in standard format (start/end/text)")
                                    transcript_text = "\n".join([
                                        f"{item.get('start', '')}-{item.get('end', '')}: {item.get('text', '')}" 
                                        for item in transcript
                                    ])
                                else:
                                    # Handle other dictionary formats
                                    logger.info("Processing transcript in non-standard dictionary format")
                                    transcript_text = "\n".join([str(item) for item in transcript])
                            elif isinstance(first_item, str):
                                # Handle string array format
                                logger.info("Processing transcript as string array")
                                transcript_text = "\n".join(transcript)
                            else:
                                # Handle any other format
                                logger.info("Processing transcript in unknown format")
                                transcript_text = str(transcript)[:2000]
                    else:
                        # If transcript is not a list, convert to string
                        logger.info(f"Transcript is not a list, converting to string")
                        transcript_text = str(transcript)[:2000]
                    
                    # Truncate to Notion's limit
                    transcript_text = transcript_text[:2000]
                    properties["Transcript"] = {
                        "rich_text": [{"text": {"content": transcript_text}}]
                    }
            
            # Add Screenshots if available and property exists
            if screenshots and "Screenshots" in self.database_properties:
                prop_type = self.database_properties["Screenshots"].get('type')
                
                if prop_type == 'rich_text':
                    # Format screenshots based on structure
                    screenshots_text = ""
                    
                    if isinstance(screenshots, list):
                        if len(screenshots) > 0:
                            # Check the format of screenshot items
                            first_item = screenshots[0]
                            logger.info(f"Screenshot first item type: {type(first_item).__name__}")
                            logger.info(f"Screenshot first item sample: {str(first_item)[:100]}")
                            
                            if isinstance(first_item, dict):
                                # Try to extract relevant info from screenshots
                                # Format: timestamp, caption if available
                                entries = []
                                for item in screenshots:
                                    timestamp = item.get('timestamp', 'unknown')
                                    caption = item.get('caption', '')
                                    if not caption and item.get('response'):
                                        caption = item.get('response')
                                    entries.append(f"Screenshot at {timestamp}: {caption}")
                                screenshots_text = "\n\n".join(entries)
                            else:
                                # Handle any other format
                                logger.info("Processing screenshots in unknown format")
                                screenshots_text = str(screenshots)[:2000]
                    else:
                        # If screenshots is not a list, convert to string
                        logger.info("Screenshots is not a list, converting to string")
                        screenshots_text = str(screenshots)[:2000]
                    
                    # Truncate to Notion's limit
                    screenshots_text = screenshots_text[:2000]  
                    properties["Screenshots"] = {
                        "rich_text": [{"text": {"content": screenshots_text}}]
                    }
                
            # Add Transcript Analysis if available and property exists
            if transcript_analysis:
                # Add Summary if available
                if transcript_analysis.get('summary') and "Summary" in self.database_properties:
                    prop_type = self.database_properties["Summary"].get('type')
                    if prop_type == 'rich_text':
                        summary_text = transcript_analysis.get('summary', '')[:2000]
                        properties["Summary"] = {
                            "rich_text": [{"text": {"content": summary_text}}]
                        }
                
                # Add Key Points if available
                if transcript_analysis.get('keyPoints') and "Key Points" in self.database_properties:
                    prop_type = self.database_properties["Key Points"].get('type')
                    if prop_type == 'rich_text':
                        key_points = transcript_analysis.get('keyPoints', [])
                        key_points_text = "\n- " + "\n- ".join(key_points) if key_points else ""
                        key_points_text = key_points_text[:2000]  # Truncate to Notion's limit
                        properties["Key Points"] = {
                            "rich_text": [{"text": {"content": key_points_text}}]
                        }
            
            # Log which properties were found and will be used
            logger.info(f"Properties being added to Notion: {list(properties.keys())}")
            
            # Prepare the final payload
            payload = {
                "parent": {"database_id": self.database_id},
                "properties": properties
            }
            
            # Log payload summary (not full content to avoid huge logs)
            logger.info(f"Notion payload prepared with {len(properties)} properties")
            logger.info(f"Properties included: {', '.join(properties.keys())}")
            
            # Make request to Notion API with error handling
            try:
                response = requests.post(
                    f"{self.api_url}/pages",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=30  # Add timeout to prevent hanging
                )
                
                # Log response status
                logger.info(f"Notion API response status: {response.status_code}")
                
                if response.status_code == 200:
                    logger.info("Successfully created Notion page")
                    # Add page URL to the response for client feedback
                    page_id = response.json().get('id', '').replace('-', '')
                    page_url = f"https://notion.so/{page_id}"
                    return {"success": True, "page_id": page_id, "page_url": page_url, **response.json()}
                elif response.status_code == 401 or response.status_code == 403:
                    error_msg = "Authentication failed. Check your Notion API key."
                    logger.error(f"{error_msg} Status: {response.status_code}")
                    return {"error": error_msg}
                elif response.status_code == 404:
                    error_msg = "Database not found. Check your Notion database ID."
                    logger.error(f"{error_msg} Status: {response.status_code}")
                    return {"error": error_msg}
                elif response.status_code == 400:
                    # Extract property error information if available
                    resp_json = response.json()
                    error_detail = resp_json.get('message', 'Unknown error')
                    if 'code' in resp_json and resp_json['code'] == 'validation_error':
                        error_msg = f"Validation error: {error_detail}. Check that your database structure matches the expected properties."
                    else:
                        error_msg = f"Bad request: {error_detail}"
                    logger.error(f"{error_msg} Status: {response.status_code}")
                    return {"error": error_msg}
                else:
                    error_msg = f"Failed to save to Notion: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return {"error": error_msg}
            except requests.exceptions.Timeout:
                error_msg = "Connection to Notion API timed out"
                logger.error(error_msg)
                return {"error": error_msg}
            except requests.exceptions.ConnectionError:
                error_msg = "Connection error. Please check your internet connection"
                logger.error(error_msg)
                return {"error": error_msg}
            
            return response.json()
            
        except Exception as e:
            logger.exception(f"Error saving to Notion: {str(e)}")
            return {"error": f"Failed to save to Notion: {str(e)}"}

# Create a singleton instance
notion_service = NotionService()
