from typing import Any, Optional

from aws_cdk import (
    App,
    Stack,
    Environment,
)
from aws_cdk import (
    aws_route53 as route_53,
    aws_s3 as s3
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

        # Set up the qaqc bucket
        s3.Bucket(
            self,
            f"{id}-bucket",
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False
            ),
            cors=s3.CorsRule(
                id=f"{id}-bucket-cors",
                allowed_origins=['*'],
                allowed_methods=[s3.HttpMethods.GET]
            )
        )

        # ECS Worker Cluster


stack_name = f"{settings.name}-app-{settings.stage}"
stack_env = Environment(account=settings.account_id, region=settings.region)

app = App()

QAQCStack(app, stack_name, env=stack_env)

app.synth()
