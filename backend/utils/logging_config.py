# utils/logging_config.py
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from datetime import datetime
import json

class CustomJSONFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the log record.
    """
    def format(self, record):
        logobj = {}
        
        # Standard log record attributes
        logobj['timestamp'] = datetime.utcfromtimestamp(record.created).isoformat() + 'Z'
        logobj['level'] = record.levelname
        logobj['name'] = record.name
        logobj['message'] = record.getMessage()
        
        # Add exception info if available
        if record.exc_info:
            logobj['exception'] = self.formatException(record.exc_info)
        
        # Add file location
        logobj['file'] = record.pathname
        logobj['line'] = record.lineno
        
        # Add process and thread info
        logobj['process'] = record.process
        logobj['process_name'] = record.processName
        logobj['thread'] = record.thread
        logobj['thread_name'] = record.threadName
        
        return json.dumps(logobj)

def setup_logging(app):
    """Configure comprehensive logging for Flask application"""
    
    # Determine log level based on environment
    if app.config.get('ENV') == 'production':
        log_level = logging.INFO
    else:
        log_level = logging.DEBUG
    
    # Clear any existing handlers to prevent duplicate logs
    if app.logger.handlers:
        app.logger.handlers.clear()
    
    # Create different formatters for different environments
    if os.environ.get('RENDER') == 'true':
        # JSON formatter for cloud environments
        formatter = CustomJSONFormatter()
    else:
        # Standard formatter for development
        formatter = logging.Formatter(
            '[%(asctime)s] [%(levelname)s] [%(process)d] [%(thread)d] '
            '[%(pathname)s:%(lineno)d] - %(message)s'
        )
    
    # Create console handler for all logs
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    app.logger.addHandler(console_handler)
    
    # In development, also log to files
    if app.config.get('ENV') == 'development':
        # Create log directory if it doesn't exist
        log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        # Create file handler for all logs
        file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'app.log'), 
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        app.logger.addHandler(file_handler)
        
        # Create file handler for errors (ERROR and above)
        error_handler = RotatingFileHandler(
            os.path.join(log_dir, 'error.log'), 
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        error_handler.setFormatter(formatter)
        error_handler.setLevel(logging.ERROR)
        app.logger.addHandler(error_handler)
    
    # Set the logger level
    app.logger.setLevel(log_level)
    
    # Log startup information
    environment = app.config.get('ENV', 'development')
    app.logger.info(f"Starting application in {environment} environment")
    app.logger.info("Logging setup complete")
    
    return app