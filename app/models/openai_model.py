import openai

def generate_completion(prompt: str, model_params: dict = None) -> str:
    if model_params is None:
        model_params = {}
    # 默认使用 gpt-3.5-turbo
    model = model_params.get('model', 'gpt-3.5-turbo')
    messages = model_params.get('messages', [
        {"role": "user", "content": prompt}
    ])
    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        **{k: v for k, v in model_params.items() if k not in ['model', 'messages']}
    )
    return response['choices'][0]['message']['content'].strip() 