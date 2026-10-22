import base64
import json
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from ai_workflow import image_parameters
from physics import DEFAULTS

image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'test').decode()
payload=dict(base=DEFAULTS,image=image,config={})
result=dict(patch={'Epsilon33':.04},evidence={'Epsilon33':'Epsilon33=0.04'},reply='识别完成',warnings=[])
with patch('ai_workflow.completion',return_value=json.dumps(result)) as call:
    assert image_parameters(payload)['patch']=={'Epsilon33':.04}
    assert call.call_args.args[1][1]['content'][1]['image_url']['url']==image
for bad in [dict(patch={'unknown':1},evidence={'unknown':'x'}),dict(patch={'Epsilon33':-.1},evidence={'Epsilon33':'x'}),dict(patch={'Epsilon33':.1},evidence={}),dict(patch={'NN':10},evidence={'NN':'NN=10'})]:
    with patch('ai_workflow.completion',return_value=json.dumps(bad)):
        try:image_parameters(payload)
        except ValueError:pass
        else:raise AssertionError(bad)
for bad_image in ['data:image/png;base64,YmFk','data:image/svg+xml;base64,YmFk',123]:
    try:image_parameters(dict(payload,image=bad_image))
    except ValueError:pass
    else:raise AssertionError('invalid image accepted')
print('PASS: image multimodal request, parameter ranges, evidence and image validation; mock provider only')
