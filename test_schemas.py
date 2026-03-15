[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*", "app/services/azure_client.py"]

[tool.coverage.report]
show_missing = true
fail_under = 60
