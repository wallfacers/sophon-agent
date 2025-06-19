"""Configuration loader and LLM cache utility."""

import os
from typing import Dict, Any, Optional

import yaml
from langchain_core.language_models import BaseLanguageModel
from langchain_openai import ChatOpenAI


class ModelConfigLoader:
    """Configuration loader for sophon-agent."""

    def __init__(self):
        """Initialize the config loader.

        Args:
            config_path: Path to the configuration file
        """
        self.config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../conf.yaml"))
        self._config: Optional[Dict[str, Any]] = None
        self._llm_cache: Dict[str, BaseLanguageModel] = {}

    def load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file.

        Returns:
            Configuration dictionary
        """
        if self._config is None:
            if not os.path.exists(self.config_path):
                raise FileNotFoundError(f"Configuration file not found: {self.config_path}")

            with open(self.config_path, 'r', encoding='utf-8') as file:
                self._config = yaml.safe_load(file)

        return self._config

    def get_llm_config(self, llm_name: str = "basic") -> Dict[str, Any]:
        """Get LLM configuration by name.

        Args:
            llm_name: Name of the LLM configuration (e.g., 'basic')

        Returns:
            LLM configuration dictionary

        Raises:
            KeyError: If the LLM configuration is not found
        """
        config = self.load_config()

        if 'llms' not in config:
            raise KeyError("No 'llms' section found in configuration")

        if llm_name not in config['llms']:
            available_llms = list(config['llms'].keys())
            raise KeyError(f"LLM '{llm_name}' not found. Available LLMs: {available_llms}")

        return config['llms'][llm_name]

    def get_llm(self, llm_name: str = "basic", force_reload: bool = False) -> BaseLanguageModel:
        """Get or create cached LLM instance.

        Args:
            llm_name: Name of the LLM configuration
            force_reload: Whether to force reload the LLM instance

        Returns:
            LLM instance
        """
        if force_reload or llm_name not in self._llm_cache:
            llm_config = self.get_llm_config(llm_name)
            
            # Create a copy of config without extra_body for dynamic parameter passing
            llm_params = {k: v for k, v in llm_config.items()}
            
            # Set default values for common parameters if not specified
            if 'temperature' not in llm_params:
                llm_params['temperature'] = 0.7
            if 'max_retries' not in llm_params:
                llm_params['max_retries'] = 2
            if 'streaming' not in llm_params:
                llm_params['streaming'] = False
            
            # Create LLM instance with dynamic parameters
            llm = ChatOpenAI(
                **llm_params
            )

            self._llm_cache[llm_name] = llm

        return self._llm_cache[llm_name]

    def list_available_llms(self) -> list:
        """List all available LLM configurations.
        
        Returns:
            List of available LLM names
        """
        config = self.load_config()
        return list(config.get('llms', {}).keys())

    def clear_llm_cache(self, llm_name: Optional[str] = None):
        """Clear LLM cache.
        
        Args:
            llm_name: Specific LLM to clear from cache. If None, clear all.
        """
        if llm_name is None:
            self._llm_cache.clear()
        elif llm_name in self._llm_cache:
            del self._llm_cache[llm_name]

    def reload_config(self):
        """Reload configuration from file and clear cache."""
        self._config = None
        self._llm_cache.clear()


# Global instance for easy access
_model_config_loader = ModelConfigLoader()


def get_llm(llm_name: str = "basic", force_reload: bool = False) -> BaseLanguageModel:
    """Get LLM instance using the global config loader.
    
    Args:
        llm_name: Name of the LLM configuration
        force_reload: Whether to force reload the LLM instance
        
    Returns:
        LLM instance
    """
    return _model_config_loader.get_llm(llm_name, force_reload)


def get_config() -> Dict[str, Any]:
    """Get configuration using the global config loader.
    
    Returns:
        Configuration dictionary
    """
    return _model_config_loader.load_config()


def list_llms() -> list:
    """List available LLMs using the global config loader.
    
    Returns:
        List of available LLM names
    """
    return _model_config_loader.list_available_llms()
