# Install necessary packages, then import the model
!pip install llama-cpp-python==0.2.82 -q -q -q

# Download the model
!wget -q https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v0.3-GGUF/resolve/main/tinyllama-1.1b-chat-v0.3.Q4_K_M.gguf?download=true -O model.gguf

# Set the model path
model_path = "model.gguf"

import pandas as pd
from llama_cpp import Llama

emails_df = pd.read_csv('data/email_categories_data.csv')

# Initialize the Llama model
llm = Llama(model_path=model_path)

# system prompt with examples
prompt = """ You are an email classifier.
Your task is to assign each email to exactly one of the following categories:
- Priority: Important or urgent emails that require immediate attention.
- Updates: Informational emails such as notifications, cancellations, or reminders.
- Promotions: Marketing or sales-related emails such as discounts, special offers, or deals.

Classify each email by reading its subject and body.
Respond with ONLY the category name (Priority, Updates, or Promotions). Do not include extra text or other categories, even if they reflect more closely the email topic.

Examples:

Example 1:
Urgent: Password Reset Required
Your account security requires immediate attention. Please reset your password within 24 hours.
Priority

Example 2:
Special Offer - 50% Off Everything!
Don't miss our biggest sale of the year. Everything must go!
Promotions

Example 3:
Canceled Event - Team Meeting
This event has been canceled and removed from your calendar.
Updates

Example 4:
"""

def process_message(llm, message, prompt):
    """Process a message and return the response"""
    input_prompt = f"{prompt} {message}"
    response = llm(
        input_prompt,
        max_tokens=5,
        temperature=0
    )

    return response['choices'][0]['text'].strip()


test_emails = emails_df.head(2)

results = []
for idx, row in test_emails.iterrows():
    email_content = row['email_content']
    expected_category = row['expected_category']

    result = process_message(llm, email_content, prompt)

    results.append({
        'email_content': email_content,
        'expected_category': expected_category,
        'model_output': result
    })

results_df = pd.DataFrame(results)

result1 = results_df['model_output'].iloc[0]
result2 = results_df['model_output'].iloc[1]

print(f"Result 1: `{result1}`\nResult 2: `{result2}`")

