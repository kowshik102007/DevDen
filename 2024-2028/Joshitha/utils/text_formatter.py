def format_response(text):
    text = text.strip()

    # Remove unwanted leftovers
    text = text.replace("Question:", "")
    text = text.replace("Answer:", "")

    return text