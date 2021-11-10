import { expect as expectCDK, SynthUtils } from '@aws-cdk/assert'
import * as cdk from '@aws-cdk/core'
import * as AwsCdkTransferSftp from '../lib/aws-cdk-transfer-sftp-stack'

test('Simple snapshot test', () => {
  const app = new cdk.App()
  const stack = new AwsCdkTransferSftp.AwsCdkTransferSftpStack(app, 'MyTestStack')

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot()
})
