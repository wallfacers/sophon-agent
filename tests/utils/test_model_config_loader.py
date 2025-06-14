from utils import get_llm, list_llms


def test_get_llm():
    llm = get_llm(llm_name="basic", force_reload=False)
    assert llm.model_name == "qwen3-235b-a22b"

def test_list_llms():
    llms = list_llms()
    assert "basic" in llms