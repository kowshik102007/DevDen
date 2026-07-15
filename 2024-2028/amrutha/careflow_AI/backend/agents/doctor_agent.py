from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

llm = ChatOpenAI(temperature=0)

prompt = ChatPromptTemplate.from_template("""
You are a Doctor Workflow Agent.
Based on symptoms and reports, suggest next steps.
Do NOT diagnose.
Do NOT prescribe medicines.

Symptoms:
{symptoms}

Reports:
{reports}
""")

def doctor_agent(state):
    response = llm.invoke(
        prompt.format_messages(
            symptoms=", ".join(state["symptoms"]),
            reports=", ".join(state["reports"])
        )
    )

    state["doctor_notes"] = response.content
    state["current_agent"] = "medicine"

    return state
