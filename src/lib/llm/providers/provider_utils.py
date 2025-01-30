from typing import Dict, Any, List, Optional

class ProviderResponseTransformer:
    @staticmethod
    def transform_lm_studio(response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform LM Studio response to standard format"""
        if not isinstance(response, dict):
            return {'data': [{'id': str(response)}]}
        return response if 'data' in response else {'data': [response]}

    @staticmethod
    def transform_claude(messages: List[Dict[str, str]], response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Claude response to OpenAI-like format"""
        return {
            'id': response.get('id', ''),
            'model': response.get('model', ''),
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': response.get('completion', '')
                },
                'finish_reason': response.get('stop_reason', 'stop')
            }]
        }

    @staticmethod
    def transform_deepseek(response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Deepseek response to standard format"""
        if 'choices' in response and isinstance(response['choices'], list):
            return response  # Already in OpenAI-like format
        
        return {
            'id': response.get('id', ''),
            'model': response.get('model', ''),
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': response.get('text', '')
                },
                'finish_reason': response.get('finish_reason', 'stop')
            }]
        }

class ProviderRequestTransformer:
    @staticmethod
    def filter_supported_params(data: Dict[str, Any], supported_params: set) -> Dict[str, Any]:
        """Filter out unsupported parameters from request data"""
        return {k: v for k, v in data.items() if k in supported_params}

    @staticmethod
    def transform_messages_to_prompt(messages: List[Dict[str, str]]) -> str:
        """Transform chat messages to a single prompt string"""
        return "\n\n".join(
            f"{msg['role'].title()}: {msg['content']}"
            for msg in messages
        )

    @staticmethod
    def prepare_claude_payload(data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare request payload for Claude API"""
        filtered_data = ProviderRequestTransformer.filter_supported_params(
            data,
            {'model', 'messages', 'temperature', 'max_tokens', 'stream'}
        )
        
        messages = filtered_data.get('messages', [])
        prompt = ProviderRequestTransformer.transform_messages_to_prompt(messages)
        
        return {
            'model': filtered_data.get('model', 'claude-3-opus-20240229'),
            'prompt': prompt,
            'max_tokens_to_sample': filtered_data.get('max_tokens', 512),
            'temperature': filtered_data.get('temperature', 0.7),
            'stream': filtered_data.get('stream', False)
        }

    @staticmethod
    def prepare_deepseek_payload(data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare request payload for Deepseek API"""
        filtered_data = ProviderRequestTransformer.filter_supported_params(
            data,
            {'model', 'messages', 'temperature', 'max_tokens', 'stream'}
        )
        
        return {
            'model': filtered_data.get('model', 'deepseek-chat'),
            'messages': filtered_data.get('messages', []),
            'temperature': filtered_data.get('temperature', 0.7),
            'max_tokens': filtered_data.get('max_tokens', 512),
            'stream': filtered_data.get('stream', False)
        }
