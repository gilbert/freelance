import { Button } from '../../../dev/components/Button'
import { Rpc } from '../../../dev/lib/rpc-client'
import { usePromise } from '../../../dev/lib/use-promise'
import CheckCircleSm from '../../../lib/icons/CheckCircleSm'


export function Complete() {
  const markComplete = usePromise(Rpc.markOnboardingComplete, { lingerLoading: true })

  return (
    <div className="flex flex-col items-center FadeInLong">
      <h3 className="pt-1 text-3xl font-header text-gray-800">
        Setup Complete
      </h3>

      <div className="px-6 max-w-xs mx-auto text-center">
        <p className="mt-4">You're all set up. May your journey be filled with success.</p>
      </div>

      <CheckCircleSm className="mt-4 h-12 w-12 text-green-500" />

      <div className="mt-4 px-6 max-w-xs mx-auto w-full">
        <Button
          title="Conclude"
          color="primary"
          className="w-full"
          loading={markComplete.isLoading}
          onClick={async () => {
            await markComplete.call({})
            window.location.href = '/'
          }}
        />
      </div>
    </div>
  )
}
