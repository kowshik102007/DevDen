from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

llm = ChatOpenAI(temperature=0)

prompt = ChatPromptTemplate.from_template("""
You are a Patient Intake Agent.
Extract symptoms clearly from the patient input.
Do not diagnose.
Just list symptoms.

Patient says:
{input}
""")

def patient_agent(state):
    response = llm.invoke(
        prompt.format_messages(input=" ".join(state["symptoms"]))
    )

    extracted = response.content.strip()

    state["symptoms"].append(extracted)
    state["current_agent"] = "doctor"

    return state
