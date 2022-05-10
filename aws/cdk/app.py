from typing import Any, Optional

from aws_cdk import (
    App,
    Stack,
    Environment,
)
from constructs import Construct

from config import StackSettings

settings = StackSettings()


class QAQCStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,  # noqa
        env: Optional[Environment] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(scope, id, env=env, **kwargs)


stack_name = f"{settings.name}-app-{settings.stage}"
stack_env = Environment(account=settings.account_id, region=settings.region)

app = App()

QAQCStack(app, stack_name, env=stack_env)

app.synth()
