"""QAQC_STACK Configs."""
import pydantic


class StackSettings(pydantic.BaseSettings):
    """Application settings"""

    class Config:
        """model config"""

        env_file = ".env"
        env_prefix = "QAQC_STACK_"

    name: str = "qaqc-dashboard"
    stage: str = "production"

    owner: str = "RCA Data Team"
    project: str = "OOI Cabled Array"

    # Stack environment
    region: str = "us-west-2"
    account_id: str = "123556123145"
