#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { AwsCdkTransferSftpStack } from '../lib/aws-cdk-transfer-sftp-stack'

const app = new cdk.App()
new AwsCdkTransferSftpStack(app, 'AwsCdkTransferSftpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
})
