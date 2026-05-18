import os
import re
import json

FRONTEND_DIR = r"c:\Users\Eobord\Desktop\chamasmart\frontend\src\services"
BACKEND_DIR = r"c:\Users\Eobord\Desktop\chamasmart\backend\src\main\java\com\chamasmart\backend\controller"

frontend_apis = []
backend_endpoints = []

# Parse Frontend
for root, _, files in os.walk(FRONTEND_DIR):
    for file in files:
        if file.endswith('.js'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    # match api.get("...") or api.post(`...`)
                    matches = re.findall(r'api\.(get|post|put|delete|patch)\(([`\'"])(.*?)\2', line)
                    for method, _, path in matches:
                        normalized_path = re.sub(r'\$\{([^}]+)\}', r'{\1}', path)
                        frontend_apis.append({
                            'method': method.upper(),
                            'path': normalized_path,
                            'file': file,
                            'line': i + 1
                        })

# Parse Backend
for root, _, files in os.walk(BACKEND_DIR):
    for file in files:
        if file.endswith('.java'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                
                class_mapping_match = re.search(r'@RequestMapping\("([^"]+)"\)', content)
                base_path = class_mapping_match.group(1) if class_mapping_match else ""
                
                mapping_pattern = r'@(Get|Post|Put|Delete|Patch)Mapping\((?:value\s*=\s*)?(?:\{)?(["\'][^"\']+["\'](?:,\s*["\'][^"\']+["\'])*)?(?:\})?.*?\)'
                for method_match in re.finditer(mapping_pattern, content):
                    method = method_match.group(1).upper()
                    paths_str = method_match.group(2)
                    if paths_str:
                        paths = re.findall(r'["\']([^"\']+)["\']', paths_str)
                    else:
                        paths = [""]
                        
                    for path in paths:
                        full_path = base_path + path
                        if full_path.endswith('/') and len(full_path) > 1:
                            full_path = full_path[:-1]
                        backend_endpoints.append({
                            'method': method,
                            'path': full_path,
                            'file': file
                        })

def normalize_spring_path(path):
    return re.sub(r'\{[^}]+\}', '{}', path)

backend_set = set()
for b in backend_endpoints:
    backend_set.add((b['method'], normalize_spring_path(b['path'])))

missing = []
for f in frontend_apis:
    f_path = normalize_spring_path(f['path'])
    if not f_path.startswith('/api/v1'):
        if not f_path.startswith('/'):
            f_path = '/' + f_path
            
    if (f['method'], f_path) not in backend_set:
        missing.append(f)

with open(r'c:\Users\Eobord\Desktop\chamasmart\.agent\scratch\missing.json', 'w', encoding='utf-8') as f:
    json.dump(missing, f, indent=2)
